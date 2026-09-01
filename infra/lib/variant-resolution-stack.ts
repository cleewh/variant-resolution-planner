import * as path from "path";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

export interface VariantResolutionPlannerStackProps extends cdk.StackProps {
  /** Bedrock model / inference-profile ID. Overridable via `-c bedrockModelId=`. */
  bedrockModelId?: string;
  /** Allowed CORS origin for the API. Defaults to "*" (demo). */
  allowedOrigin?: string;
}

const WEB_DIST = path.join(__dirname, "..", "..", "web", "dist");
const HANDLER_ENTRY = path.join(__dirname, "..", "..", "server", "src", "handler.ts");
const SERVER_LOCK = path.join(__dirname, "..", "..", "server", "package-lock.json");

export class VariantResolutionPlannerStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: VariantResolutionPlannerStackProps = {}
  ) {
    super(scope, id, props);

    const modelId =
      props.bedrockModelId || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
    const allowedOrigin = props.allowedOrigin || "*";

    if (!fs.existsSync(WEB_DIST)) {
      throw new Error(
        `Frontend build not found at ${WEB_DIST}. Run "npm --prefix web run build" before deploying.`
      );
    }

    // --- Bedrock explanation Lambda -------------------------------------
    const apiFn = new NodejsFunction(this, "ExplainFn", {
      entry: HANDLER_ENTRY,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      depsLockFilePath: SERVER_LOCK,
      environment: {
        BEDROCK_MODEL_ID: modelId,
        ALLOWED_ORIGIN: allowedOrigin,
      },
      bundling: {
        // The Node.js 22 runtime already includes AWS SDK v3.
        externalModules: ["@aws-sdk/*"],
        minify: true,
        target: "node22",
      },
      description: "Generates the Variant Resolution Plan narrative via Amazon Bedrock.",
    });

    // Least-privilege-ish: allow invoking Anthropic Claude models and the
    // cross-region inference profiles that front them. Scope further in prod.
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    );

    // Front the Lambda with an API Gateway HTTP API. The integration permission
    // uses the apigateway service principal (scoped to this API) — it is NOT a
    // public Lambda policy, so it is compatible with accounts that block public
    // Lambda Function URLs. Payload format 2.0 delivers the same event shape the
    // handler already expects.
    const integration = new HttpLambdaIntegration("ExplainIntegration", apiFn);
    const httpApi = new apigwv2.HttpApi(this, "Api", {
      description: "Variant Resolution Planner - Bedrock explanation API.",
      corsPreflight: {
        allowOrigins: [allowedOrigin],
        allowMethods: [
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["content-type"],
      },
    });
    httpApi.addRoutes({ path: "/explain", methods: [apigwv2.HttpMethod.POST], integration });
    httpApi.addRoutes({ path: "/annotate", methods: [apigwv2.HttpMethod.POST], integration });
    httpApi.addRoutes({ path: "/health", methods: [apigwv2.HttpMethod.GET], integration });

    const apiDomain = `${httpApi.httpApiId}.execute-api.${this.region}.${cdk.Aws.URL_SUFFIX}`;

    // --- Static site: private S3 + CloudFront (OAC) ---------------------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Demo convenience: tear everything down cleanly on destroy.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Route the API (POST /explain, GET /health) to the HTTP API, same-origin
    // behind CloudFront (so the SPA needs no CORS).
    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: new origins.HttpOrigin(apiDomain, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // needs POST
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/explain": apiBehavior,
        "/annotate": apiBehavior,
        "/health": apiBehavior,
      },
      // SPA fallback: serve index.html for client-side routes / missing keys.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
      comment: "Variant Resolution Planner SPA",
    });

    // Deploy the built SPA. The client calls the API same-origin (CloudFront
    // routes /explain and /annotate to the backend), so no runtime config.json
    // URL injection is needed.
    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    // --- Outputs --------------------------------------------------------
    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Open this URL to use the Variant Resolution Planner.",
    });
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: `https://${distribution.distributionDomainName}/explain`,
      description:
        "Bedrock explanation API (via CloudFront -> IAM-authed Lambda URL).",
    });
    new cdk.CfnOutput(this, "BedrockModelId", { value: modelId });
  }
}
