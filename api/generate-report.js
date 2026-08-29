// api/generate-report.js
// Vercel serverless function. Call with: POST /api/generate-report
// Body: { jobNumber: "1234", password: "your-shared-secret" }
// Returns: application/pdf


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
const LOGO_URL = `${process.env.SITE_URL || "https://wmelectricalgroup.com"}/public/assets/logo.png`;
// Maps ServiceM8's Form Field labels (exactly as they appear in your form) to the
// short keys used in report-template.js. Update the left-hand label strings if yours differ.
const FIELD_LABEL_MAP = {
  "Property Address": "property_address",
  "Property Manager/ Agency": "property_manager_agency",
  "Tenant Name (If occupied)": "tenant_name",
  "Inspection Date": "inspection_date",
  "Technician Name": "technician_name",
  "Switchboard Overview Photo": "switchboard_photo",
  "Faulty safety switch(es)": "faulty_safety_switches",
  "Is there a Sub-board on site?": "subboard_present",
  "Sub-board Overview Photo": "subboard_photo",
  "Are all alarms Interconnected?": "alarms_interconnected",
  "Which Smoke alarms did not sound?": "smoke_alarms_not_sound",
  "Does the property comply with Smoke Alarm Regulations QLD?": "smoke_alarm_compliant",
  "What Is needed for Smoke alarm compliance?": "smoke_alarm_compliance_needed",
  "Suggestion to meet compliance.": "smoke_alarm_compliance_suggestion",
  "Suggestions based on inspection": "suggestions",
  "Sign Off": "signature",
};

// These 4 questions are asked TWICE on the form - once for Main Switchboard,
// once for Sub-board - using identical wording both times. We tell them apart
// by ORDER: first time we see the label = main switchboard, second time = sub-board.
const DUPLICATE_LABELS = {
  "Any visual damage to switchboard & or switchgear?": ["any_visual_damage", "subboard_any_visual_damage"],
  "List Visual Faults": ["list_visual_faults", "subboard_list_visual_faults"],
  "RCD’s/ RCBO’s present?": ["rcds_rcbos_present", "subboard_rcds_rcbos_present"],
  "Push-Button Test Result": ["pushbutton_test_result", "subboard_pushbutton_test_result"],
};

for (let i = 1; i <= 8; i++) {
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Location`] = `smoke_alarm_${i}_location`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Install/ Manufacturing Date`] = `smoke_alarm_${i}_install_date`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Result`] = `smoke_alarm_${i}_result`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Non-Compliance Reason`] = `smoke_alarm_${i}_noncompliance_reason`;
  FIELD_LABEL_MAP[`Smoke Alarm ${i} Photo`] = `smoke_alarm_${i}_photo`;
}
for (let i = 1; i <= 20; i++) {
  FIELD_LABEL_MAP[`Defect ${i}`] = `defect_${i}`;
  FIELD_LABEL_MAP[`Defect ${i} severity`] = `defect_${i}_severity`;
  FIELD_LABEL_MAP[`Defect ${i} Severity`] = `defect_${i}_severity`;
  FIELD_LABEL_MAP[`Defect ${i} Photo`] = `defect_${i}_photo`;
  FIELD_LABEL_MAP[`Defect ${i} solution`] = `defect_${i}_solution`;
  FIELD_LABEL_MAP[`Defect ${i} Solution`] = `defect_${i}_solution`;
}


async function buildDataFromFormResponse(formResponse) {
  let answers = [];
  try {
    answers = JSON.parse(formResponse.field_data || "[]");
  } catch {
    console.error("Could not parse field_data:", formResponse.field_data);
  }

  const data = {};
  const photoAnswers = [];
  const duplicateLabelCounts = {};

  for (const answer of answers) {
    const label = answer.Question;
    let key;

    if (DUPLICATE_LABELS[label]) {
      const seen = duplicateLabelCounts[label] || 0;
      const options = DUPLICATE_LABELS[label];
      key = options[seen] || options[options.length - 1];
      duplicateLabelCounts[label] = seen + 1;
    } else {
      key = FIELD_LABEL_MAP[label];
    }
    if (!key) continue;

    const value = answer.Response ?? "";

    if (key === "signature" && value) {
      photoAnswers.push({ key: `${key}_url`, attachmentUuid: value, sizeProfile: "small" });
    } else if (answer.FieldType === "Photo" && value) {
      const sizeProfile = key.startsWith("defect_") ? "large" : "small";
      photoAnswers.push({ key: `${key}_url`, attachmentUuid: value, sizeProfile });
    } else {
      data[key] = value;
    }
  }

  for (const p of photoAnswers) {
    try {
      data[p.key] = await getAttachmentUrl(p.attachmentUuid, p.sizeProfile);
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
        const data = await buildDataFromFormResponse(formResponse);


       if (req.body.debug) {
      return res.status(200).json({
        rawFieldData: formResponse.field_data,
        parsedAnswersSample: JSON.parse(formResponse.field_data || "[]").slice(0, 3),
        mappedData: data,
      });
    }


    const html = buildReportHtml(data, LOGO_URL);


       

    const pdfShiftKey = process.env.PDFSHIFT_API_KEY;
    if (!pdfShiftKey) {
      throw new Error("Missing PDFSHIFT_API_KEY environment variable");
    }
    const authHeader = "Basic " + Buffer.from(`api:${pdfShiftKey}`).toString("base64");

    const pdfShiftRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: html,
        landscape: false,
        use_print: true,
      }),
    });

    if (!pdfShiftRes.ok) {
      const errBody = await pdfShiftRes.text().catch(() => "");
      throw new Error(`PDFShift conversion failed: ${pdfShiftRes.status} ${errBody}`);
    }

    const pdfArrayBuffer = await pdfShiftRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

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
