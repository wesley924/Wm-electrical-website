// lib/report-template.js
// Takes a plain JS object of answers (already mapped from ServiceM8 field labels)
// and returns the final HTML string for the branded inspection report.
// Any smoke alarm / defect with no data is simply skipped - true conditional
// rendering, not a Word/Jotform workaround.

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function badge(value, type = "auto") {
  if (!value) return "";
  const v = String(value).toLowerCase();
  let cls = "badge-na";
  if (type === "auto") {
    if (["yes", "pass", "no", "compliant"].includes(v)) cls = "badge-pass";
    if (["fail", "non-compliant", "no rcd"].includes(v)) cls = "badge-fail";
  }
  return `<span class="badge ${cls}">${esc(value).toUpperCase()}</span>`;
}

// For rows OUTSIDE tables: only flag the negative answer in red.
// A good/normal answer is just plain text - no badge at all.
function statusOrPlain(value, negativeValues) {
  if (!value) return "";
  const v = String(value).toLowerCase();
  if (negativeValues.includes(v)) {
    return `<span class="badge badge-fail">${esc(value).toUpperCase()}</span>`;
  }
  return esc(value);
}


function severityClass(sev) {
  const v = (sev || "").toLowerCase();
  if (v === "urgent") return "badge-fail";
  if (v === "recommended") return "badge-caution";
  return "badge-pass"; // Maintenance and anything else
}


function buildSmokeAlarmRows(data) {
  let rows = "";
  for (let i = 1; i <= 8; i++) {
    const location = data[`smoke_alarm_${i}_location`];
    if (!location) continue; // <-- the actual fix: skip entirely if empty
    const date = data[`smoke_alarm_${i}_install_date`] || "&mdash;";
    const result = data[`smoke_alarm_${i}_result`];
    const reason = data[`smoke_alarm_${i}_noncompliance_reason`] || "";
    const photo = data[`smoke_alarm_${i}_photo_url`];
    rows += `
      <tr>
        <td>${esc(location)}</td>
        <td>${esc(date)}</td>
        <td>${badge(result)}</td>
        <td>${esc(reason)}</td>
        <td class="thumb-cell">${photo ? `<img class="thumb" src="${photo}">` : "&mdash;"}</td>
      </tr>`;
  }
  return rows;
}

function buildDefectRows(data) {
  let rows = "";
  let count = 0;
  for (let i = 1; i <= 20; i++) {
    const desc = data[`defect_${i}`];
    if (!desc) continue;
    count++;
    const severity = data[`defect_${i}_severity`];
    const photo = data[`defect_${i}_photo_url`];
    const solution = data[`defect_${i}_solution`] || "";
    rows += `
      <tr>
        <td>${count}</td>
        <td>${esc(desc)}</td>
        <td><span class="badge ${severityClass(severity)}">${esc(severity)}</span></td>
        <td class="thumb-cell">${photo ? `<img class="thumb" src="${photo}">` : "&mdash;"}</td>
        <td>${esc(solution)}</td>
      </tr>`;
  }
  return rows || `<tr><td colspan="5" class="empty-note">No defects recorded on this inspection.</td></tr>`;
}


function buildReportHtml(data, logoDataUri) {
  const smokeAlarmRows = buildSmokeAlarmRows(data);
  const defectRows = buildDefectRows(data);

  const showMainVisualFaults = (data.any_visual_damage || "").toLowerCase() === "yes";
  const showMainPushButton = (data.rcds_rcbos_present || "").toLowerCase() === "yes";

  const hasSubboard = (data.subboard_present || "").toLowerCase() === "yes";
  const showSubVisualFaults = (data.subboard_list_visual_faults && (data.subboard_any_visual_damage || "").toLowerCase() === "yes");
  const showSubPushButton = (data.subboard_rcds_rcbos_present || "").toLowerCase() === "yes";

  const showSmokeAlarmsNotSound = !!data.smoke_alarms_not_sound;

  return `<!DOCTYPE html>

<html><head><meta charset="UTF-8"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; font-size: 10.5pt; line-height: 1.45; width: 210mm; }
  .page { padding: 14mm 16mm 16mm 16mm; }
  .header { display: table; width: 100%; border-bottom: 3px solid #6faaa5; padding-bottom: 10px; margin-bottom: 16px; }
  .header .logo-cell { display: table-cell; vertical-align: middle; width: 55mm; }
  .header .logo-cell img { height: 30px; }
  .header .title-cell { display: table-cell; vertical-align: middle; text-align: right; }
  .header .title-cell h1 { font-size: 16pt; color: #3a3a3a; font-weight: 700; }
  .header .title-cell .sub { font-size: 9pt; color: #6faaa5; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .section-title { background: #3a3a3a; color: #fff; font-size: 10pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 6px 10px; margin-top: 18px; margin-bottom: 8px; }
  .info-grid { display: table; width: 100%; }
  .info-row { display: table-row; }
  .info-label, .info-value { display: table-cell; padding: 5px 8px; border-bottom: 1px solid #e5e5e5; font-size: 9.5pt; }
  .info-label { width: 40mm; color: #6b6b6b; font-weight: 600; }
  .info-value { color: #2a2a2a; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 3px; font-size: 8.5pt; font-weight: 700; }
  .badge-pass { background: #e3f3f1; color: #2f7d74; }
  .badge-fail { background: #fbe7e6; color: #b3392f; }
      .badge-na { background: #eee; color: #6b6b6b; }
    .badge-caution { background: #fff4d6; color: #8a6d1d; }
  table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.data-table th { background: #eef4f3; color: #3a3a3a; font-size: 8.5pt; text-transform: uppercase; text-align: left; padding: 6px 8px; border-bottom: 2px solid #6faaa5; }
  table.data-table td { padding: 6px 8px; font-size: 9.3pt; border-bottom: 1px solid #ececec; vertical-align: middle; }
  table.data-table tr:nth-child(even) td { background: #fafafa; }
  .thumb { width: 16mm; height: 12mm; object-fit: cover; border-radius: 2px; border: 1px solid #ddd; }
  .thumb-cell { width: 18mm; text-align: center; }
  .severity-major { color: #b3392f; font-weight: 700; }
  .severity-minor { color: #b3892f; font-weight: 700; }
  .severity-info { color: #2f7d74; font-weight: 700; }
  .empty-note { font-size: 9pt; color: #8a8a8a; font-style: italic; padding: 8px; }
  .sign-block { display: table; width: 100%; margin-top: 22px; }
  .sign-cell { display: table-cell; width: 50%; vertical-align: bottom; padding-right: 10mm; }
  .sign-line { border-top: 1px solid #999; margin-top: 26px; padding-top: 4px; font-size: 8.5pt; color: #6b6b6b; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7.8pt; color: #8a8a8a; text-align: center; }
</style></head>
<body><div class="page">

  <div class="header">
    <div class="logo-cell"><img src="${logoDataUri}"></div>
    <div class="title-cell">
      <h1>Property Condition Report</h1>
      <div class="sub">WM Electrical Group</div>
    </div>
  </div>

  <div class="section-title">Property &amp; Inspection Details</div>
  <div class="info-grid">
    <div class="info-row"><div class="info-label">Property Address</div><div class="info-value">${esc(data.property_address)}</div></div>
    <div class="info-row"><div class="info-label">Property Manager / Agency</div><div class="info-value">${esc(data.property_manager_agency)}</div></div>
    <div class="info-row"><div class="info-label">Tenant Name</div><div class="info-value">${esc(data.tenant_name) || "&mdash;"}</div></div>
    <div class="info-row"><div class="info-label">Inspection Date</div><div class="info-value">${esc(data.inspection_date)}</div></div>
    <div class="info-row"><div class="info-label">Technician</div><div class="info-value">${esc(data.technician_name)}</div></div>
    <div class="section-title">Main Switchboard</div>
  <div class="info-grid">
    ${data.switchboard_photo ? `<div class="info-row"><div class="info-label">Switchboard Photo</div><div class="info-value"><img class="thumb" src="${data.switchboard_photo}"></div></div>` : ""}
    <div class="info-row"><div class="info-label">Visual Damage Present?</div><div class="info-value">${statusOrPlain(data.any_visual_damage, ["yes"])}</div></div>
    ${showMainVisualFaults ? `<div class="info-row"><div class="info-label">Visual Faults</div><div class="info-value">${esc(data.list_visual_faults)}</div></div>` : ""}
            <div class="info-row"><div class="info-label">RCDs / RCBOs Present?</div><div class="info-value">${badge(data.rcds_rcbos_present)}</div></div>
       ${showMainPushButton ? `<div class="info-row"><div class="info-label">Push-Button Test Result</div><div class="info-value">${badge(data.pushbutton_test_result)}</div></div>` : ""}
  </div>
  ${data.faulty_safety_switches ? `<div class="info-grid"><div class="info-row"><div class="info-label">Faulty Safety Switch(es)</div><div class="info-value">${esc(data.faulty_safety_switches)}</div></div></div>` : ""}

  ${hasSubboard ? `
  <div class="section-title">Sub-board</div>
  <div class="info-grid">
    ${data.subboard_photo ? `<div class="info-row"><div class="info-label">Sub-board Photo</div><div class="info-value"><img class="thumb" src="${data.subboard_photo}"></div></div>` : ""}
    <div class="info-row"><div class="info-label">Visual Damage Present?</div><div class="info-value">${statusOrPlain(data.subboard_any_visual_damage, ["yes"])}</div></div>
    ${showSubVisualFaults ? `<div class="info-row"><div class="info-label">Visual Faults</div><div class="info-value">${esc(data.subboard_list_visual_faults)}</div></div>` : ""}
            <div class="info-row"><div class="info-label">RCDs / RCBOs Present?</div><div class="info-value">${badge(data.subboard_rcds_rcbos_present)}</div></div>
    ${showSubPushButton ? `<div class="info-row"><div class="info-label">Push-Button Test Result</div><div class="info-value">${badge(data.subboard_pushbutton_test_result)}</div></div>` : ""}
  </div>` : ""}


    <div class="section-title">Smoke Alarms</div>
  <div class="info-grid" style="margin-bottom:6px;">
    <div class="info-row"><div class="info-label">All Alarms Interconnected?</div><div class="info-value">${statusOrPlain(data.alarms_interconnected, ["no"])}</div></div>
    ${showSmokeAlarmsNotSound ? `<div class="info-row"><div class="info-label">Which Smoke Alarms Did Not Sound?</div><div class="info-value">${esc(data.smoke_alarms_not_sound)}</div></div>` : ""}
  </div>
  <table class="data-table">
    <tr><th>Location</th><th>Install / Mfg Date</th><th>Result</th><th>Non-Compliance Reason</th><th class="thumb-cell">Photo</th></tr>
    ${smokeAlarmRows || `<tr><td colspan="5" class="empty-note">No smoke alarm data recorded.</td></tr>`}
  </table>
  <div class="info-grid" style="margin-top:6px;">
    <div class="info-row"><div class="info-label">Complies with QLD Regs?</div><div class="info-value">${statusOrPlain(data.smoke_alarm_compliant, ["no"])}</div></div>
    ${data.smoke_alarm_compliance_needed ? `<div class="info-row"><div class="info-label">Needed for Compliance</div><div class="info-value">${esc(data.smoke_alarm_compliance_needed)}</div></div>` : ""}
    ${data.smoke_alarm_compliance_suggestion ? `<div class="info-row"><div class="info-label">Suggestion to Meet Compliance</div><div class="info-value">${esc(data.smoke_alarm_compliance_suggestion)}</div></div>` : ""}
  </div>

  <div class="section-title">Defect Register</div>
  <table class="data-table">
    <tr><th style="width:8mm">#</th><th>Description</th><th style="width:24mm">Severity</th><th class="thumb-cell">Photo</th><th>Solution</th></tr>
    ${defectRows}
  </table>
  ${data.suggestions ? `<div class="info-grid" style="margin-top:6px;"><div class="info-row"><div class="info-label">Suggestions</div><div class="info-value">${esc(data.suggestions)}</div></div></div>` : ""}


  <div class="section-title">Defect Register</div>
  <table class="data-table">
    <tr><th style="width:8mm">#</th><th>Description</th><th style="width:24mm">Severity</th><th class="thumb-cell">Photo</th></tr>
    ${defectRows}
  </table>

  <div class="sign-block">
  <div class="sign-cell">
    ${data.signature_url ? `<img src="${data.signature_url}" style="height:18mm;display:block;">` : ""}
    <div class="sign-line">Technician Signature &nbsp;&bull;&nbsp; ${esc(data.technician_name)}</div>
  </div>
    <div class="sign-cell"><div class="sign-line">Date &nbsp;&bull;&nbsp; ${esc(data.inspection_date)}</div></div>
  </div>

  <div class="footer">
    WM Electrical Group Pty Ltd &nbsp;|&nbsp; QLD Electrical Contractor Licence 1506251 &nbsp;|&nbsp; ABN 74 688 853 750<br>
    0421 606 446 &nbsp;|&nbsp; info@wmelectricalgroup.com &nbsp;|&nbsp; Yandina Creek, QLD 4561
  </div>

</div></body></html>`;
}

module.exports = { buildReportHtml };
