#!/usr/bin/env python3
"""Build expanded medical CPT pricing database."""
import json, os

c = {}
def a(code, d, cat, mr, cr_lo, cr_hi, n):
    c[code] = {'description':d,'category':cat,'medicareRate':mr,'commercialRange':[cr_lo,cr_hi],'notes':n}

# Office visits
a('99202','New patient visit (L2)','office_visit',76,100,200,'15-29 min')
a('99203','New patient visit (L3)','office_visit',135,175,350,'30-44 min')
a('99204','New patient visit (L4)','office_visit',205,275,500,'45-59 min')
a('99205','New patient visit (L5)','office_visit',265,350,650,'60-74 min')
a('99211','Established visit (L1)','office_visit',28,35,80,'Nurse visit')
a('99212','Established visit (L2)','office_visit',60,80,160,'10-19 min')
a('99213','Established visit (L3)','office_visit',110,150,300,'Most common. 20-29 min')
a('99214','Established visit (L4)','office_visit',165,200,400,'Moderate. 30-39 min')
a('99215','Established visit (L5)','office_visit',225,300,550,'High complexity. 40-54 min')
a('99385','Preventive, new, 18-39','office_visit',175,200,400,'Annual physical')
a('99386','Preventive, new, 40-64','office_visit',195,225,450,'Annual physical')
a('99395','Preventive, est, 18-39','office_visit',155,175,350,'$0 under ACA')
a('99396','Preventive, est, 40-64','office_visit',170,190,380,'$0 under ACA')
a('99397','Preventive, est, 65+','office_visit',180,200,400,'Medicare Wellness')
a('99441','Phone E&M, 5-10 min','office_visit',40,50,120,'Telehealth')
a('99442','Phone E&M, 11-20 min','office_visit',75,90,180,'Telehealth')
a('99443','Phone E&M, 21-30 min','office_visit',110,130,260,'Telehealth')
# ER
a('99281','ER visit (L1)','emergency',50,150,500,'Minor')
a('99282','ER visit (L2)','emergency',95,300,900,'Low-moderate')
a('99283','ER visit (L3)','emergency',150,500,1500,'Most common')
a('99284','ER visit (L4)','emergency',250,800,2500,'Urgent')
a('99285','ER visit (L5)','emergency',350,1500,4000,'Life-threatening')
a('99291','Critical care, first hr','emergency',400,1000,3000,'ICU-level')
a('99292','Critical care, addl 30m','emergency',200,500,1500,'Add-on')
# Imaging
a('70553','MRI brain w/wo contrast','imaging',437,1100,3500,'Freestanding 40-60% less')
a('70551','MRI brain w/o contrast','imaging',310,800,2500,'Ask if contrast needed')
a('70552','MRI brain w contrast','imaging',370,950,3000,'Gadolinium')
a('72148','MRI lumbar w/o contrast','imaging',310,800,2800,'Back pain')
a('72141','MRI cervical w/o contrast','imaging',310,800,2800,'Neck')
a('73721','MRI knee w/o contrast','imaging',310,800,2500,'Ortho')
a('73221','MRI shoulder w/o contrast','imaging',310,800,2500,'Rotator cuff')
a('74177','CT abd/pelvis w contrast','imaging',290,500,2500,'Common CT')
a('74176','CT abd/pelvis w/o','imaging',230,400,2000,'No contrast')
a('74178','CT abd/pelvis w/wo','imaging',340,600,3000,'Dual-phase')
a('70450','CT head w/o contrast','imaging',189,400,2000,'ER head CT')
a('70460','CT head w contrast','imaging',230,500,2500,'With contrast')
a('71260','CT chest w contrast','imaging',250,500,2000,'PE/lung')
a('71046','Chest X-ray, 2 views','imaging',31,75,350,'Basic')
a('71045','Chest X-ray, 1 view','imaging',24,50,250,'Single view')
a('73030','Shoulder X-ray, 2+ views','imaging',28,60,300,'Ortho')
a('73562','Knee X-ray, 3 views','imaging',30,65,325,'Common')
a('73610','Ankle X-ray, 3 views','imaging',28,60,300,'Injury')
a('73130','Hand X-ray, 2+ views','imaging',26,55,275,'Fracture')
a('76856','US pelvic, complete','imaging',120,200,800,'OB/GYN')
a('76830','US transvaginal','imaging',130,200,800,'GYN')
a('76700','US abdominal, complete','imaging',130,200,800,'Abdominal')
a('76805','US pregnant uterus','imaging',145,200,600,'OB ultrasound')
a('77067','Screening mammo, bilateral','imaging',140,150,500,'$0 ACA preventive')
a('77066','Diagnostic mammo, bilateral','imaging',160,200,600,'May cost share')
a('93000','EKG, complete','imaging',20,50,300,'Heart test')
a('93306','Echocardiogram, complete','imaging',230,400,1500,'Heart US')
a('93010','EKG interpretation only','imaging',10,20,100,'Reading fee')
a('78452','Nuclear stress test','imaging',350,800,3000,'Cardiac perfusion')
# Lab
a('85025','CBC with differential','lab',11,25,150,'Never >$50 at lab')
a('80053','Comprehensive metabolic panel','lab',14,30,200,'Basic chemistry')
a('80048','Basic metabolic panel','lab',11,25,150,'Subset of CMP')
a('80061','Lipid panel','lab',18,30,150,'Quest cash: $30-50')
a('81001','Urinalysis with microscopy','lab',5,15,100,'Should <$30')
a('81003','Urinalysis, automated','lab',4,10,80,'Dipstick')
a('36415','Venipuncture (blood draw)','lab',3,10,50,'Billed separately')
a('84443','TSH (thyroid)','lab',23,35,200,'Thyroid function')
a('83036','Hemoglobin A1c','lab',13,25,150,'Diabetes monitoring')
a('82947','Glucose, blood','lab',8,15,100,'Blood sugar')
a('82306','Vitamin D, 25-hydroxy','lab',40,50,250,'Vitamin D')
a('82728','Ferritin','lab',18,25,150,'Iron stores')
a('84153','PSA','lab',25,35,200,'Prostate screening')
a('87086','Urine culture','lab',10,20,120,'UTI')
a('87491','Chlamydia nucleic acid','lab',36,50,200,'STI screening')
a('87804','Influenza rapid test','lab',17,25,150,'Flu test')
a('87635','COVID-19 PCR','lab',51,75,300,'SARS-CoV-2')
a('80076','Hepatic function panel','lab',12,25,150,'Liver')
a('85610','PT (prothrombin time)','lab',6,15,80,'Clotting')
a('88305','Pathology, tissue exam','lab',75,100,500,'Biopsy analysis')
a('88112','Cytopathology (Pap)','lab',25,35,150,'Cervical screening')
# Surgery
a('27447','Total knee replacement','surgery',1695,4000,30000,'Surgeon fee. Total $30-70K')
a('27130','Total hip replacement','surgery',1750,4000,30000,'Surgeon fee. Total $30-65K')
a('47562','Lap cholecystectomy','surgery',800,3000,15000,'ASC saves 40-60%')
a('49505','Inguinal hernia repair','surgery',700,3000,12000,'Outpatient')
a('29881','Knee arthroscopy','surgery',733,3000,15000,'Meniscectomy')
a('29827','Shoulder arthroscopy, RC','surgery',900,5000,20000,'Rotator cuff')
a('66984','Cataract surgery w IOL','surgery',685,2000,8000,'Most common US surgery')
a('44970','Lap appendectomy','surgery',750,5000,20000,'Emergency')
a('58571','Lap hysterectomy','surgery',1200,6000,25000,'Major GYN')
a('22551','Anterior cervical fusion','surgery',1800,8000,40000,'Spinal fusion')
a('63047','Lumbar laminectomy','surgery',1500,6000,30000,'Back surgery')
a('93458','Cardiac catheterization','surgery',990,3000,15000,'Heart cath')
a('33533','CABG, single graft','surgery',2500,15000,60000,'Bypass')
a('92928','Coronary stent','surgery',1200,5000,25000,'PCI')
a('19301','Lumpectomy','surgery',650,3000,12000,'Breast cancer')
a('19303','Mastectomy, total','surgery',1100,5000,20000,'Complete')
# Maternity
a('59400','OB care, vaginal delivery','maternity',2500,5000,15000,'Global OB fee')
a('59510','Cesarean delivery','maternity',2800,7000,25000,'Total $15-45K')
a('59409','Vaginal delivery only','maternity',1200,3000,8000,'Delivery only')
a('59025','Fetal non-stress test','maternity',55,80,300,'Heart monitoring')
# Mental health
a('90837','Psychotherapy, 60 min','mental_health',130,150,300,'Standard session')
a('90834','Psychotherapy, 45 min','mental_health',105,120,250,'Shorter')
a('90832','Psychotherapy, 30 min','mental_health',75,90,180,'Brief')
a('90791','Psychiatric eval','mental_health',180,250,500,'Initial eval')
a('90792','Psychiatric eval w medical','mental_health',200,275,550,'With meds')
a('90847','Family therapy, w patient','mental_health',120,150,300,'Family')
a('90853','Group psychotherapy','mental_health',35,40,100,'Group')
# PT
a('97110','Therapeutic exercises 15m','physical_therapy',38,50,120,'3-4 units typical')
a('97140','Manual therapy 15m','physical_therapy',38,50,120,'Hands-on')
a('97530','Therapeutic activities 15m','physical_therapy',40,55,130,'Functional')
a('97161','PT eval, low','physical_therapy',95,120,250,'Initial')
a('97162','PT eval, moderate','physical_therapy',115,140,300,'Moderate')
a('97163','PT eval, high','physical_therapy',135,165,350,'Complex')
a('97035','Ultrasound therapy 15m','physical_therapy',18,25,80,'Therapeutic US')
a('97116','Gait training 15m','physical_therapy',35,45,110,'Walking/balance')
# Inpatient
a('99221','Hospital admit (L1)','inpatient',150,300,600,'Low')
a('99222','Hospital admit (L2)','inpatient',210,400,800,'Moderate')
a('99223','Hospital admit (L3)','inpatient',280,500,1200,'High')
a('99231','Hospital visit (L1)','inpatient',80,150,300,'Daily, stable')
a('99232','Hospital visit (L2)','inpatient',110,200,400,'Daily, moderate')
a('99233','Hospital visit (L3)','inpatient',160,300,600,'Daily, complex')
a('99238','Discharge, <=30 min','inpatient',100,200,400,'Discharge')
a('99239','Discharge, >30 min','inpatient',140,275,550,'Complex')
# Procedures
a('43239','EGD with biopsy','procedure',350,1500,5000,'ASC cheaper')
a('45378','Colonoscopy, diagnostic','procedure',521,1500,5000,'$0 screening ACA')
a('45380','Colonoscopy w biopsy','procedure',574,2000,6000,'Watch reclassification')
a('45385','Colonoscopy w polypectomy','procedure',620,2000,7000,'Polypectomy')
a('52000','Cystoscopy','procedure',250,600,2500,'Bladder exam')
a('57454','Colposcopy w biopsy','procedure',200,400,1500,'After abnormal Pap')
a('11102','Skin biopsy, tangential','procedure',95,150,500,'Shave biopsy')
a('11104','Skin biopsy, punch','procedure',120,175,600,'Punch biopsy')
a('10060','I&D abscess','procedure',160,300,1000,'Draining')
a('12001','Wound repair <=2.5cm','procedure',130,250,800,'Simple laceration')
a('12002','Wound repair 2.6-7.5cm','procedure',160,300,1000,'Medium')
a('20610','Joint injection, major','procedure',80,150,500,'Steroid injection')
a('64483','Epidural steroid injection','procedure',350,800,3000,'Pain mgmt')
a('36430','Blood transfusion','procedure',80,200,800,'Per unit')
a('94640','Nebulizer treatment','procedure',20,50,250,'Breathing')
a('96372','Injection, IM/SQ','procedure',25,50,200,'Drug extra')
a('96374','IV push, single','procedure',55,100,400,'IV med push')
a('96365','IV infusion, initial 1hr','procedure',65,150,600,'IV fluid/drug')
a('96366','IV infusion, addl hour','procedure',30,60,250,'Additional')
# Anesthesia
a('00142','Anesthesia, eye','anesthesia',200,300,1000,'Time units')
a('01996','Epidural anesthesia, labor','anesthesia',400,1500,4000,'Labor')
a('00740','Anesthesia, upper GI','anesthesia',300,500,1500,'Endoscopy')
a('00810','Anesthesia, lower GI','anesthesia',300,500,1500,'Colonoscopy')
a('01402','Anesthesia, knee replace','anesthesia',500,800,2500,'Arthroplasty')
# Pharmacy
a('J2405','Ondansetron inj 1mg','pharmacy',1,5,50,'Zofran generic')
a('J3490','Unclassified drugs','pharmacy',0,10,500,'Ask specifics')
# Dental
a('D2740','Crown, porcelain','dental',0,800,2000,'No Medicare')
a('D3330','Root canal, molar','dental',0,1000,2000,'Molar')
a('D7210','Surgical extraction','dental',0,250,600,'Per tooth')

data = {
  'metadata': {'source':'CMS MPFS 2026, RAND 2024, Milliman 2025','baseYear':2026,'conversionFactor':33.40,'inflationRate':0.03,
    'commercialMultipliers':{'professional':1.48,'outpatient_facility':2.63,'inpatient_facility':2.09,'overall':2.54},'codeCount':len(c)},
  'gpciLocalities': {'notes':'GPCI adjusts Medicare by locality. PE GPCI has largest impact.',
    'stateMultipliers':{'AL':0.90,'AK':1.25,'AZ':0.98,'AR':0.87,'CA':1.22,'CO':1.02,'CT':1.12,'DE':1.05,'FL':1.00,'GA':0.98,'HI':1.15,'ID':0.92,'IL':1.05,'IN':0.95,'IA':0.93,'KS':0.92,'KY':0.92,'LA':0.95,'ME':0.98,'MD':1.08,'MA':1.15,'MI':1.00,'MN':0.98,'MS':0.85,'MO':0.92,'MT':0.95,'NE':0.92,'NV':1.02,'NH':1.05,'NJ':1.15,'NM':0.93,'NY':1.18,'NC':0.95,'ND':0.93,'OH':0.98,'OK':0.90,'OR':1.05,'PA':1.02,'RI':1.08,'SC':0.93,'SD':0.90,'TN':0.93,'TX':0.98,'UT':0.95,'VT':0.98,'VA':1.00,'WA':1.10,'WV':0.88,'WI':0.98,'WY':0.95,'DC':1.15}},
  'facilityMultipliers':{'hospital_outpatient':1.0,'hospital_inpatient':1.3,'ambulatory_surgery_center':0.58,'physician_office':0.45,'emergency_room':2.8,'freestanding_imaging':0.40,'freestanding_lab':0.30,'urgent_care':0.70,'notes':'ASC saves 42% vs HOPD. Freestanding imaging 40-60% less.'},
  'commercialByState':{'notes':'Commercial as % of Medicare (RAND 2024). Unlisted=2.54.','AR':1.70,'IA':1.85,'MA':1.90,'MI':1.95,'MS':1.95,'MN':2.10,'OH':2.15,'PA':2.20,'MO':2.20,'TN':2.25,'TX':2.40,'IL':2.50,'VA':2.50,'NC':2.55,'CO':2.60,'AZ':2.60,'OR':2.70,'WA':2.75,'NJ':2.80,'MD':2.85,'CA':3.10,'DE':3.05,'FL':3.10,'GA':3.15,'NY':3.05,'SC':3.10,'WV':3.10,'WI':3.15},
  'ncciCommonBundles':[
    {'col1':'80053','col2':'80048','rule':'CMP includes BMP. Do not bill both.'},
    {'col1':'80053','col2':'82310','rule':'CMP includes calcium.'},
    {'col1':'80053','col2':'82947','rule':'CMP includes glucose.'},
    {'col1':'85025','col2':'85004','rule':'CBC w/diff includes manual diff.'},
    {'col1':'45380','col2':'45378','rule':'Colonoscopy w/biopsy includes diagnostic.'},
    {'col1':'45385','col2':'45378','rule':'Polypectomy includes diagnostic.'},
    {'col1':'45385','col2':'45380','rule':'Polypectomy includes biopsy.'},
    {'col1':'43239','col2':'43235','rule':'EGD w/biopsy includes diagnostic.'},
    {'col1':'93000','col2':'93010','rule':'Complete EKG includes interpretation.'},
    {'col1':'93000','col2':'93005','rule':'Complete EKG includes tracing.'},
    {'col1':'93306','col2':'93303','rule':'Complete echo includes limited.'},
    {'col1':'59510','col2':'59400','rule':'C-section includes vaginal attempt.'},
    {'col1':'77067','col2':'77066','rule':'Screening mammo not with diagnostic.'},
    {'col1':'29881','col2':'29880','rule':'Meniscectomy includes arthroscopy.'},
    {'col1':'47562','col2':'49320','rule':'Lap chole includes diagnostic lap.'},
    {'col1':'58571','col2':'58661','rule':'Hysterectomy includes cyst removal.'},
    {'col1':'12001','col2':'12002','rule':'Cannot bill overlapping repair sizes.'},
    {'col1':'99214','col2':'99213','rule':'Cannot bill two E&M same visit.'}],
  'noSurprisesAct':{'effectiveDate':'2022-01-01','violations':[
    {'flag':'balance_billing_emergency','desc':'Balance billing for emergency services prohibited.'},
    {'flag':'no_good_faith_estimate','desc':'Provider must give cost estimate before scheduled service.'},
    {'flag':'oon_at_inn_facility','desc':'OON provider at in-network facility cannot balance bill without consent.'},
    {'flag':'cost_exceed_estimate','desc':'If bill exceeds estimate by $400+, patient can dispute.'}]},
  'billingErrorStats':{'errorRate':'49-80%','avgErrorOnLargeBill':1300,'initialDenialRate':0.26,'commonErrors':['Duplicate charges','Upcoding','Unbundling','Balance billing violations','Screening reclassified as diagnostic','Generic meds at brand prices','Facility fee at physician office','Wrong quantity/units']},
  'commonCPTCodes': c,
  'categories':{'office_visit':{'label':'Office Visits'},'emergency':{'label':'Emergency Room'},'imaging':{'label':'Imaging (MRI, CT, X-ray)'},'lab':{'label':'Lab Work'},'surgery':{'label':'Surgery'},'maternity':{'label':'Maternity & Delivery'},'mental_health':{'label':'Mental Health'},'physical_therapy':{'label':'Physical Therapy'},'inpatient':{'label':'Hospital Stays'},'procedure':{'label':'Procedures'},'anesthesia':{'label':'Anesthesia'},'pharmacy':{'label':'Pharmacy / Drugs'},'dental':{'label':'Dental'}},
  'billCheckItems':[
    {'key':'cptCodes','label':'CPT codes listed for each charge','weight':15},
    {'key':'itemized','label':'Each service listed separately','weight':12},
    {'key':'facility','label':'Facility vs professional fee separated','weight':12},
    {'key':'insuranceApplied','label':'Insurance adjustments applied','weight':10},
    {'key':'inNetwork','label':'Provider in-network','weight':10},
    {'key':'duplicates','label':'No duplicate charges','weight':10},
    {'key':'dateMatch','label':'Service dates match visit','weight':8},
    {'key':'unbundling','label':'No unbundled charges','weight':8},
    {'key':'upcoding','label':'Visit level matches complexity','weight':8},
    {'key':'patientResponsibility','label':'Patient responsibility stated','weight':7}]
}

out = os.path.join(os.path.dirname(__file__), '..', 'data', 'medical-cpt-pricing.json')
with open(out, 'w') as f:
    json.dump(data, f, indent=2)
print(f'Saved {len(c)} CPT codes to {out}')
