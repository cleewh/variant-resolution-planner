// ---------------------------------------------------------------------------
// Local development server.
//
// Runs the same Bedrock explanation endpoint on http://localhost:8787 so you
// can develop the frontend against a real Bedrock backend without deploying.
// Requires AWS credentials in the environment (standard AWS SDK credential
// chain) and Bedrock model access enabled in your region.
//
//   Frontend: set web/.env  ->  VITE_API_URL=http://localhost:8787
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import { generateNarrative, bedrockConfig, NarrativeGuardrailError } from "./bedrock";
import { fetchAnnotation } from "./annotate";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8787);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ...bedrockConfig });
});

app.post("/explain", async (req, res) => {
  const { case: variantCase, plan } = req.body ?? {};
  if (!variantCase || !plan) {
    res.status(400).json({ error: "Body must include 'case' and 'plan'" });
    return;
  }
  try {
    const narrative = await generateNarrative(variantCase, plan);
    res.json({ narrative, source: "bedrock" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bedrock error";
    if (err instanceof NarrativeGuardrailError) {
      console.warn("Guardrail rejected narrative:", message);
      res.status(422).json({ error: "Narrative failed safety guardrail", detail: message });
      return;
    }
    console.error("Bedrock error:", message);
    res.status(502).json({ error: "Bedrock enhancement failed", detail: message });
  }
});

app.post("/annotate", async (req, res) => {
  const { gene, genomicId, rsId, entrezId } = req.body ?? {};
  if (!gene && !genomicId && !rsId && !entrezId) {
    res.status(400).json({ error: "Provide at least one of: gene, genomicId, rsId, entrezId" });
    return;
  }
  try {
    const annotation = await fetchAnnotation({ gene, genomicId, rsId, entrezId });
    res.json(annotation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Annotation error";
    res.status(502).json({ error: "Annotation failed", detail: message });
  }
});

app.listen(PORT, () => {
  console.log(`Variant Resolution Planner API listening on http://localhost:${PORT}`);
  console.log(`Bedrock region=${bedrockConfig.REGION} model=${bedrockConfig.MODEL_ID}`);
});
