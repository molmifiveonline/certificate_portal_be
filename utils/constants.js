// Candidate Constants
const USER_MERGE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "mobile",
  "status",
];

const PROFILE_MERGE_FIELDS = [
  "middle_name",
  "prefix",
  "gender",
  "dob",
  "nationality",
  "passport_no",
  "employee_id",
  "manager",
  "rank",
  "whatsapp_number",
  "alternate_mobile",
  "indos_number",
  "registration_type",
  "designation",
  "vessel_type",
  "last_vessel_name",
  "next_vessel_name",
  "manning_company",
  "sign_on_date",
  "sign_off_date",
  "officer",
  "seaman_book_no",
  "profile_image",
];

const MERGEABLE_FIELDS = [...USER_MERGE_FIELDS, ...PROFILE_MERGE_FIELDS];

const RELATED_COUNT_QUERIES = {
  courses_enrollment: {
    table: "courses_enrollment",
    column: "candidate_id",
  },
  assessment_results: {
    table: "assessment_results",
    column: "candidate_id",
  },
  feedback_question_answer: {
    table: "feedback_question_answer",
    column: "candidate_id",
  },
  certificates: {
    table: "certificates",
    column: "candidate_id",
  },
  hotel_files: {
    table: "hotel_files",
    column: "candidate_id",
  },
  reimbursements: {
    table: "reimbursements",
    column: "candidate_id",
  },
  candidate_sync_logs: {
    table: "candidate_sync_logs",
    column: "candidate_user_id",
  },
};

// Course Enrollment Constants
const ACKNOWLEDGMENT_COLUMNS = [
  "ack_token",
  "ack_status",
  "ack_date",
  "ack_remark",
];

// Reimbursement Constants
const REIMBURSEMENT_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  RESUBMISSION_REQUESTED: "resubmission_requested",
  RESUBMITTED: "resubmitted",
  APPROVED: "approved",
  DISAPPROVED: "disapproved",
};

// Question Bank Constants
const QUESTION_TEMPLATE_HEADERS = [
  "Question",
  "Master Course ID",
  "Type of Test",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Option",
];

const MASTER_COURSE_DROPDOWN_START_ROW = 2;
const MASTER_COURSE_DROPDOWN_END_ROW = 1001;

// Sync & Auth Constants
const PRE_ACTIVE_COURSE_SYNC_CONFIG = {
  tokenUrl: "https://courseplanner.molmi.info/api/auth/token",
  apiUrl: "https://courseplanner.molmi.info/api/get-scheduled-course",
  clientId: "916cdf5c-30db-4e48-b070-88d2309a813d",
  clientSecret: "h7a7RqA7muDZvoyePLe1TWtvpuj1HBVOfOO50DmM",
};

const CANDIDATE_SYNC_CONFIG = {
  tokenUrl: "https://apim-mts-prod.azure-api.net/MOLMI-Training/api/Token",
  apiUrl:
    "https://apim-mts-prod.azure-api.net/MOLMI-Training/api/ShipmateWebService",
  username: "apiuser@sbntech.com",
  password: "u$eR@apI123",
  subscriptionKey: "d292c094732f423c8f5f7547aa98453a",
  authKey: "MOLMI_SBNT",
  serviceName: "PersonnelDetails_MOLMI",
};

const NOMINATOR_ADMIN_PERMISSIONS = ["view_pre_active_courses"];

// Report Constants
const TRAINING_RECORD_MONTH_HEADERS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "June",
  "July",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

const TRAINING_RECORD_SECTION_ORDER = ["Online", "Offline", "Outhouse"];

const TRG219_DOCUMENT_CODE = "TRG/219";
const TRG219_DOCUMENT_REVISION = "Rev. 6.1";
const TRG219_DOCUMENT_DATE = "18 Jun 2024";

const TRG219_SECTION_DEFINITIONS = [
  {
    key: "SIMULATOR_BASED_COURSE",
    title: "SIMULATOR BASED COURSE",
    codes: [
      "LNGSTDMNG",
      "LNGSTDOPR",
      "CCRRM",
      "SHS",
      "BRM",
      "ERM",
      "LICOS",
      "ECDIS",
      "NWS",
      "PEK",
      "ESDC",
      "MOLSEC",
      "MEC",
      "NCIC",
    ],
  },
  {
    key: "MOLMI_OUTHOUSE_COURSES",
    title: "MOLMI OUTHOUSE COURSES",
    codes: [],
  },
  {
    key: "OTHER_COURSES",
    title: "OTHER COURSES",
    codes: [],
  },
];

const TRG219_SECTION_ORDER = TRG219_SECTION_DEFINITIONS.map(
  (section) => section.key,
);

module.exports = {
  USER_MERGE_FIELDS,
  PROFILE_MERGE_FIELDS,
  MERGEABLE_FIELDS,
  RELATED_COUNT_QUERIES,
  ACKNOWLEDGMENT_COLUMNS,
  REIMBURSEMENT_STATUS,
  QUESTION_TEMPLATE_HEADERS,
  MASTER_COURSE_DROPDOWN_START_ROW,
  MASTER_COURSE_DROPDOWN_END_ROW,
  PRE_ACTIVE_COURSE_SYNC_CONFIG,
  CANDIDATE_SYNC_CONFIG,
  NOMINATOR_ADMIN_PERMISSIONS,
  TRAINING_RECORD_MONTH_HEADERS,
  TRAINING_RECORD_SECTION_ORDER,
  TRG219_DOCUMENT_CODE,
  TRG219_DOCUMENT_REVISION,
  TRG219_DOCUMENT_DATE,
  TRG219_SECTION_DEFINITIONS,
  TRG219_SECTION_ORDER,
};
