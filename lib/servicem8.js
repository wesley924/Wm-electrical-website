// lib/servicem8.js
// Thin wrapper around the ServiceM8 REST API.
// Docs: https://developer.servicem8.com/reference

const SM8_BASE = "https://api.servicem8.com/api_1.0";
const sharp = require("sharp");



function authHeaders() {
  const apiKey = process.env.SM8_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SM8_API_KEY environment variable");
  }
  return {
    "X-API-Key": apiKey,
    Accept: "application/json",
  };
}


async function sm8Get(path) {
  const res = await fetch(`${SM8_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ServiceM8 GET ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * Find a Job by its human-readable Job Number (generated_job_id), e.g. "1234".
 * Returns the job record (including its uuid) or null if not found.
 */
async function getJobByNumber(jobNumber) {
  const filter = encodeURIComponent(`generated_job_id eq '${jobNumber}'`);
  const jobs = await sm8Get(`/job.json?%24filter=${filter}`);
  return Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
}

/**
 * Get all Form Responses linked to a given job UUID.
 * A job can have more than one form attached, so this returns an array.
 */
async function getFormResponsesForJob(jobUuid) {
  const filter = encodeURIComponent(
    `regarding_object eq 'job' and regarding_object_uuid eq '${jobUuid}'`
  );
  return sm8Get(`/formresponse.json?%24filter=${filter}`);
}


/**
 * Get the Form Field definitions for a given form, so we can map
 * each answer's field_uuid back to a human label (e.g. "Smoke Alarm 1 Location").
 */
async function getAttachmentUrl(attachmentUuid, sizeProfile = "small") {
  const width = sizeProfile === "large" ? 1200 : 600;
  const quality = sizeProfile === "large" ? 82 : 70;

  const fileRes = await fetch(`${SM8_BASE}/attachment/${attachmentUuid}.file`, {
    headers: authHeaders(),
  });
  if (!fileRes.ok) {
    throw new Error(`Failed to download attachment file: ${fileRes.status}`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  const resizedBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  const base64 = resizedBuffer.toString("base64");
  return `data:image/jpeg;base64,${base64}`;
}



/**
 * Get a single Form Response's full answer set (field values + attached photos).
 */
async function getFormResponse(formResponseUuid) {
  return sm8Get(`/formresponse/${formResponseUuid}.json`);
}



module.exports = {
  getJobByNumber,
  getFormResponsesForJob,

  getFormResponse,
  getAttachmentUrl,
};
