#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VariantResolutionPlannerStack } from "../lib/variant-resolution-stack";

const app = new cdk.App();

new VariantResolutionPlannerStack(app, "VariantResolutionPlanner", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description:
    "Variant Resolution Planner - research/demo prototype (SPA on S3+CloudFront, Bedrock explanation Lambda).",
  // Optional overrides via CDK context: -c bedrockModelId=... -c allowedOrigin=...
  bedrockModelId: app.node.tryGetContext("bedrockModelId"),
  allowedOrigin: app.node.tryGetContext("allowedOrigin"),
});
