// api/generate-report.js
// Vercel serverless function. Call with: POST /api/generate-report
// Body: { jobNumber: "1234", password: "your-shared-secret" }
// Returns: application/pdf

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const {
  getJobByNumber,
  getFormResponsesForJob,
  getFormFields,
  getFormResponse,
  getAttachmentUrl,
} = require("../lib/servicem8");
const { buildReportHtml } = require("../lib/report-template");

// Logo is served as a normal static file from /public/assets/logo.png.
// SITE_URL should be your live domain, e.g. https://wmelectricalgroup.com
const LOGO_URL = `${process.env.SITE_URL || "https://wmelectricalgroup.com"}/assets/logo.png`;

// Maps ServiceM8's Form Field labels (exactly as they appear in your form) to the
// short keys used in report-template.js. Update the left-hand label strings if yours differ.
const FIELD_LABEL_MAP = {
  "Property Address": "property_address",
  "Property Manager/ Agency": "property_manager_agency",
  "Tenant Name (If occupied)": "tenant_name",
  "Inspection Date": "inspection_date",
  "Technician Name": "technician_name",
  "Any visual damage to switchboard & or switchgear?": "any_visual_damage",
  "List Visual Faults": "list_visual_faults",
  "RCD's/ RCBO's present?": "rcds_rcbos_present",
  "Push-Button Test Result": "pushbutton_test_result",
  "Are all alarms Interconnected?": "alarms_interconnected",
};

for (let i = 1; i <= 8; i++) {
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Location`] = `smoke_alarm_${i}_location`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Install/ Manufacturing Date`] = `smoke_alarm_${i}_install_date`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Result`] = `smoke_alarm_${i}_result`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Non-Compliance Reason`] = `smoke_alarm_${i}_noncompliance_reason`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Photo`] = `smoke_alarm_${i}_photo`; // resolved to _photo_url below
}
for (let i = 1; i <= 10; i++) {
  FIELD_LABEL_MAP[`Defect ${i}`] = `defect_${i}`;
  FIELD_LABEL_MAP[`Defect ${i} severity`] = `defect_${i}_severity`;
  FIELD_LABEL_MAP[`Defect ${i} Severity`] = `defect_${i}_severity`; // form has inconsistent casing
  FIELD_LABEL_MAP[`Defect ${i} Photo`] = `defect_${i}_photo`;
}

async function buildDataFromFormResponse(formResponse, formFields) {
  const labelByUuid = {};
  for (const f of formFields) {
    labelByUuid[f.uuid] = f.field_name || f.label;
  }

  let answers = [];
  try {
    answers = JSON.parse(formResponse.field_data || "[]");
  } catch {
    console.error("Could not parse field_data:", formResponse.field_data);
  }

  const data = {};
  const photoAnswers = [];

  for (const answer of answers) {
    const fieldUuid = answer.form_field_uuid || answer.field_uuid || answer.uuid;
    const label = labelByUuid[fieldUuid];
    if (!label) continue;
    const key = FIELD_LABEL_MAP[label];
    if (!key) continue;

    const value = answer.value ?? answer.answer ?? answer.response ?? "";
    const attachmentUuid = answer.attachment_uuid || answer.photo_uuid || null;

    if (key.endsWith("_photo") && attachmentUuid) {
      photoAnswers.push({ key: `${key}_url`, attachmentUuid });
    } else {
      data[key] = value;
    }
  }

  for (const p of photoAnswers) {
    try {
      data[p.key] = await getAttachmentUrl(p.attachmentUuid);
    } catch {
      data[p.key] = null;
    }
  }

  return data;
}


module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { jobNumber, password } = req.body || {};

  if (!password || password !== process.env.ADMIN_TOOL_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  if (!jobNumber) {
    return res.status(400).json({ error: "jobNumber is required" });
  }

  try {
    const job = await getJobByNumber(jobNumber);
    if (!job) {
      return res.status(404).json({ error: `No job found with number ${jobNumber}` });
    }

    const formResponses = await getFormResponsesForJob(job.uuid);
    if (!formResponses || formResponses.length === 0) {
      return res.status(404).json({ error: "No inspection form found on this job" });
    }

    // If a job could have multiple forms attached, pick the most recent one.
    const formResponseSummary = formResponses[formResponses.length - 1];
    const formResponse = await getFormResponse(formResponseSummary.uuid);
    const formFields = await getFormFields(formResponseSummary.form_uuid);

    const data = await buildDataFromFormResponse(formResponse, formFields);

    const html = buildReportHtml(data, LOGO_URL);

    const browser = await puppeteer.launch({
  args: [...chromium.args, "--disable-setuid-sandbox", "--no-sandbox"],
  executablePath: await chromium.executablePath(),
  headless: true,
});

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Inspection Report - Job ${jobNumber}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
