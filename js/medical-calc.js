// Woogoro Medical calculator — single source of truth for /medical-estimate.
// Different shape from home-services verticals: pricing is base × region ×
// insurance multiplier (patient responsibility), not labor × materials.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroMedicalCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MEDICAL_PRICING = {
    services: {
      er: { label: "Emergency Room Visit", subtypes: {
        basic:    { label: "Basic ER visit (minor injury/illness)",        baseLow: 800,  baseHigh: 2000 },
        moderate: { label: "Moderate ER visit (stitches, fracture)",       baseLow: 1500, baseHigh: 4000 },
        complex:  { label: "Complex ER visit (chest pain, trauma)",        baseLow: 3000, baseHigh: 8000 },
        pediatric:{ label: "Pediatric ER visit",                            baseLow: 800,  baseHigh: 3000 }
      }},
      surgery: { label: "Surgery", subtypes: {
        knee_replacement: { label: "Knee replacement",            baseLow: 20000, baseHigh: 50000 },
        hip_replacement:  { label: "Hip replacement",             baseLow: 22000, baseHigh: 55000 },
        appendectomy:     { label: "Appendectomy",                baseLow: 10000, baseHigh: 35000 },
        hernia:           { label: "Hernia repair",               baseLow: 6000,  baseHigh: 20000 },
        gallbladder:      { label: "Gallbladder removal",         baseLow: 8000,  baseHigh: 25000 },
        c_section:        { label: "C-section delivery",          baseLow: 15000, baseHigh: 35000 },
        acl:              { label: "ACL reconstruction",          baseLow: 15000, baseHigh: 40000 },
        cataract:         { label: "Cataract surgery (per eye)",  baseLow: 3500,  baseHigh: 7000 }
      }},
      imaging: { label: "Imaging (MRI/CT/X-ray)", subtypes: {
        mri_brain:  { label: "MRI - Brain",         baseLow: 1000, baseHigh: 3000 },
        mri_knee:   { label: "MRI - Knee/Joint",    baseLow: 500,  baseHigh: 2500 },
        mri_spine:  { label: "MRI - Spine",         baseLow: 1000, baseHigh: 3500 },
        ct_scan:    { label: "CT scan",             baseLow: 500,  baseHigh: 2500 },
        xray:       { label: "X-ray",               baseLow: 100,  baseHigh: 500 },
        ultrasound: { label: "Ultrasound",          baseLow: 200,  baseHigh: 800 },
        mammogram:  { label: "Mammogram",           baseLow: 150,  baseHigh: 600 }
      }},
      lab: { label: "Lab Work", subtypes: {
        blood_panel: { label: "Complete blood panel (CBC + CMP)",  baseLow: 50,  baseHigh: 300 },
        lipid:       { label: "Lipid panel (cholesterol)",         baseLow: 30,  baseHigh: 150 },
        thyroid:     { label: "Thyroid panel",                     baseLow: 50,  baseHigh: 200 },
        a1c:         { label: "Hemoglobin A1C (diabetes)",         baseLow: 30,  baseHigh: 120 },
        urinalysis:  { label: "Urinalysis",                        baseLow: 20,  baseHigh: 100 },
        std:         { label: "STD panel",                         baseLow: 50,  baseHigh: 500 },
        allergy:     { label: "Allergy testing",                   baseLow: 150, baseHigh: 500 }
      }},
      office_visit: { label: "Office Visit", subtypes: {
        new_patient: { label: "New patient visit",        baseLow: 200, baseHigh: 400 },
        follow_up:   { label: "Follow-up visit",          baseLow: 100, baseHigh: 250 },
        specialist:  { label: "Specialist consultation",  baseLow: 250, baseHigh: 600 },
        urgent_care: { label: "Urgent care visit",        baseLow: 150, baseHigh: 350 },
        telehealth:  { label: "Telehealth visit",         baseLow: 50,  baseHigh: 150 }
      }},
      physical_therapy: { label: "Physical Therapy", subtypes: {
        eval:       { label: "Initial evaluation",         baseLow: 150,  baseHigh: 400 },
        session:    { label: "Per session (follow-up)",    baseLow: 75,   baseHigh: 250 },
        package_12: { label: "12-session package",         baseLow: 900,  baseHigh: 3000 },
        package_24: { label: "24-session package",         baseLow: 1800, baseHigh: 5500 }
      }},
      childbirth: { label: "Childbirth", subtypes: {
        vaginal:           { label: "Vaginal delivery (uncomplicated)",  baseLow: 8000,  baseHigh: 20000 },
        vaginal_epidural:  { label: "Vaginal delivery with epidural",    baseLow: 10000, baseHigh: 25000 },
        c_section:         { label: "C-section (scheduled)",             baseLow: 15000, baseHigh: 35000 },
        c_section_emergency:{ label: "C-section (emergency)",            baseLow: 20000, baseHigh: 45000 },
        prenatal_care:     { label: "Full prenatal care package",        baseLow: 2000,  baseHigh: 5000 }
      }},
      dental: { label: "Dental", subtypes: {
        cleaning:      { label: "Routine cleaning & exam",         baseLow: 100,  baseHigh: 300 },
        filling:       { label: "Filling (per tooth)",             baseLow: 150,  baseHigh: 400 },
        crown:         { label: "Crown (per tooth)",               baseLow: 800,  baseHigh: 2000 },
        root_canal:    { label: "Root canal",                      baseLow: 700,  baseHigh: 1800 },
        extraction:    { label: "Tooth extraction",                baseLow: 150,  baseHigh: 600 },
        wisdom_teeth:  { label: "Wisdom teeth removal (all 4)",    baseLow: 1000, baseHigh: 3500 },
        implant:       { label: "Dental implant (per tooth)",      baseLow: 2000, baseHigh: 5000 }
      }}
    },
    insuranceMultipliers: {
      insured_in:     { label: "Insured (in-network)",           mult: 0.25, desc: "In-network with insurance" },
      insured_out:    { label: "Insured (out-of-network)",       mult: 0.50, desc: "Out-of-network with insurance" },
      insured_unsure: { label: "Insured (network unknown)",      mult: 0.35, desc: "Insurance, network status unknown" },
      self_pay:       { label: "Self-pay (no insurance)",        mult: 0.60, desc: "Self-pay / uninsured" },
      medicare:       { label: "Medicare",                       mult: 0.20, desc: "Medicare coverage" },
      medicaid:       { label: "Medicaid",                       mult: 0.05, desc: "Medicaid coverage" }
    },
    regionMultipliers: { northeast: 1.22, southeast: 1.00, midwest: 0.95, south: 0.98, mountain: 1.05, west: 1.28 }
  };

  var STATE_REGIONS = {
    AL:"southeast",AK:"west",AZ:"west",AR:"south",CA:"west",CO:"mountain",CT:"northeast",
    DE:"northeast",FL:"southeast",GA:"southeast",HI:"west",ID:"mountain",IL:"midwest",
    IN:"midwest",IA:"midwest",KS:"midwest",KY:"southeast",LA:"south",ME:"northeast",
    MD:"northeast",MA:"northeast",MI:"midwest",MN:"midwest",MS:"south",MO:"midwest",
    MT:"mountain",NE:"midwest",NV:"west",NH:"northeast",NJ:"northeast",NM:"mountain",
    NY:"northeast",NC:"southeast",ND:"midwest",OH:"midwest",OK:"south",OR:"west",
    PA:"northeast",RI:"northeast",SC:"southeast",SD:"midwest",TN:"southeast",TX:"south",
    UT:"mountain",VT:"northeast",VA:"southeast",WA:"west",WV:"southeast",WI:"midwest",
    WY:"mountain",DC:"northeast"
  };

  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  function calcMedicalEstimate(opts) {
    opts = opts || {};
    var svc = MEDICAL_PRICING.services[opts.serviceType];
    if (!svc) return null;
    var sub = svc.subtypes[opts.subType];
    if (!sub) return null;
    var regionMult = MEDICAL_PRICING.regionMultipliers[opts.region] || 1.0;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var insData = MEDICAL_PRICING.insuranceMultipliers[opts.insuranceKey];
    var insMult = insData ? insData.mult : 0.60;

    var baseLow  = Math.round(sub.baseLow  * regionMult * inflationMult);
    var baseHigh = Math.round(sub.baseHigh * regionMult * inflationMult);
    var patientLow  = Math.round(baseLow  * insMult);
    var patientHigh = Math.round(baseHigh * insMult);

    // Flywheel: medical pricing flywheel exists per FLYWHEEL-1 (cal:medical:* aggregates).
    // Blend the patient-mid (where users see the most variance) when available.
    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    var patientMid = (patientLow + patientHigh) / 2;
    if (opts.calData && FB && FB.FlywheelBlend && patientMid > 0) {
      var blended = FB.FlywheelBlend.blendMid(patientMid, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) {
        var ratio = blended.mid / patientMid;
        patientLow = Math.round(patientLow * ratio);
        patientHigh = Math.round(patientHigh * ratio);
        flywheelApplied = true;
      }
    }

    return {
      serviceLabel: svc.label,
      subTypeLabel: sub.label,
      baseLow: baseLow, baseHigh: baseHigh,
      patientLow: patientLow, patientHigh: patientHigh,
      insMult: insMult,
      insLabel: insData ? insData.desc : "Self-pay",
      flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence
    };
  }

  return {
    MEDICAL_PRICING: MEDICAL_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    getRegionFromState: getRegionFromState,
    calcMedicalEstimate: calcMedicalEstimate
  };
});
