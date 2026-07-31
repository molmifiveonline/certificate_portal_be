const getBaseEmailHtml = (bodyContent) => {
  const year = new Date().getFullYear();
  return `<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px 0;
        }
        .content {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
            font-weight: 700;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-top: 32px;
            border-top: 1px solid #f1f5f9;
            padding-top: 16px;
        }
        .card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .card-title {
            margin-top: 0;
            margin-bottom: 12px;
            color: #0f172a;
            font-size: 15px;
            font-weight: 600;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
        }
        .info-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .info-list li {
            margin-bottom: 8px;
            font-size: 14px;
            color: #334155;
        }
        .info-list li:last-child {
            margin-bottom: 0;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            color: #ffffff !important;
            background-color: #2563eb;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            text-align: center;
        }
        .button-success {
            background-color: #10b981;
        }
        .button-danger {
            background-color: #ef4444;
        }
    </style>
</head>
<body>
    <div class='content'>
        ${bodyContent}
        <div class='footer'>
            <p>&copy; ${year} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
};

const getWelcomeCandidateOfflineHtml = (data) => {
  const reportingTimeHtml = data.type !== 'online' ? `<li><strong>COURSE REPORTING TIME:</strong> ${data.reporting_time || '09:15'} IST</li>` : '';
  
  let venueHtml = '';
  if (data.type === 'online') {
      venueHtml = `
      <div class="card">
          <div class="card-title">Meeting Details</div>
          <ul class="info-list">
              <li><strong>ZOOM LINK:</strong> <a href="${data.zoom_link}">${data.zoom_link}</a></li>
          </ul>
      </div>`;
  } else if (data.venue_name && data.venue_name.toLowerCase() !== 'local') {
      venueHtml = `
      <div class="card">
          <div class="card-title">HOTEL LOCATION DETAILS</div>
          <ul class="info-list">
              <li><strong>HOTEL NAME:</strong> ${data.venue_name}</li>
              <li><strong>ADDRESS:</strong> ${data.venue_address || ''}</li>
              <li><strong>CONTACT NUMBER:</strong> ${data.venue_contact || ''}</li>
              <li><strong>GOOGLE MAP LINK:</strong> <a href="${data.venue_map_link}">${data.venue_map_link || ''}</a></li>
          </ul>
      </div>`;
  }

  const docAttachedHtml = (data.type !== 'online' && data.venue_name && data.venue_name.toLowerCase() !== 'local') ? `
  <div class="card">
      <div class="card-title">DOCUMENTS ATTACHED (AS APPLICABLE)</div>
      <ul class="info-list" style="list-style: bullet; padding-left: 20px;">
          <li>FLIGHT DETAILS</li>
          <li>REIMBURSEMENT FORM</li>
          <li>OTHER REQUIRED DOCUMENTS</li>
      </ul>
  </div>` : '';

  const medicalAssistanceHtml = data.type !== 'online' ? `
  <p style="font-size: 14px; color: #475569;">PLEASE ENSURE YOU REPORT AT THE TRAINING LOCATION ON TIME. IN CASE OF ANY MEDICAL ASSISTANCE DURING YOUR STAY, PLEASE CONTACT:</p>` : '';

  const body = `
  <div class='header'>
      <h2>WELCOME TO MOLTCI (ONSITE COURSE)</h2>
  </div>
  <p style="font-size: 15px; color: #1e293b;">DEAR ${String(data.candidate_name || '').toUpperCase()},</p>
  <p style="font-size: 14px; color: #334155;">GOOD DAY,</p>
  <p style="font-size: 14px; color: #334155;">MOL TRAINING CENTRE NOMINATES YOU TO UNDERGO THE FOLLOWING TRAINING.</p>
  <p style="font-size: 15px; color: #0f172a;">WELCOME ! ABOARD! YOU HAVE BEEN SUCCESSFULLY ENROLLED IN: <strong>${String(data.course_name || '').toUpperCase()}</strong></p>
  
  <div class="card">
      <div class="card-title">COURSE DETAILS</div>
      <ul class="info-list">
          <li><strong>COURSE ID:</strong> ${data.course_id || ''}</li>
          <li>
            <strong>DURATION:</strong> ${data.duration} ${data.duration > 1 ? 'DAYS' : 'DAY'}
            (${data.start_date} to ${data.end_date})
          </li>
          <li><strong>PRIMARY TRAINER:</strong> ${!data.trainer_name ? 'Not Mentioned' : data.trainer_name}</li>
          ${reportingTimeHtml}
          <li><strong>COURSE START TIME:</strong> ${data.start_time || '09:30'} IST</li>
          <li><strong>COURSE END TIME:</strong> ${data.end_time || '17:30'} IST</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">TRAINING LOCATION DETAILS</div>
      <ul class="info-list">
          <li><strong>LOCATION (VENUE):</strong> ${data.training_location_name || ''}</li>
          <li><strong>TRAINING LOCATION ADDRESS:</strong> ${data.training_address || ''}</li>
          <li><strong>TRAINING LOCATION MAP LINK:</strong> ${data.training_map_link || ''}</li>
      </ul>
  </div>

  ${venueHtml}
  
  <p style="font-size: 13px; color: #475569; font-style: italic;">* PLEASE NOTE WE HAVE ARRANGED YOUR ACCOMMODATION WITH THE FACILITY OF AIRPORT PICKUP/DROP & REGULAR PICKUP/DROP TO TRAINING INSTITUTE DURING COURSE DAYS.</p>
  <p style="font-size: 13px; color: #475569; font-style: italic;">* IN CASE YOUR FLIGHTS HAVE BEEN BOOKED FOR THE LAST DAY OF YOUR COURSE, YOU ARE REQUESTED TO CHECK OUT FROM THE HOTEL/ GUEST HOUSE AND COME WITH YOUR BAGGAGE TO THE TRAINING CENTRE IN THE MORNING ONLY. ALSO, ADVICE THE RECEPTION ABOUT THE SAME AND ARRANGE FOR THE TRANSPORT FROM THE TRAINING CENTRE  FOR PICK UP IN THE EVENING FOR AIRPORT DROP DIRECTLY.</p>
  
  ${docAttachedHtml}
  
  <div class="card">
      <div class="card-title">COMMUNICATION</div>
      <p style="margin: 0; font-size: 14px;"><strong>WHATSAPP GROUP: </strong><a href="${data.whatsapp_link}"> JOIN HERE</a> FOR DAY-TO-DAY NOTIFICATIONS AND UPDATES.</p>
  </div>

  <div class="card">
      <div class="card-title">LOG IN REQUIREMENTS FOR CANDIDATE PLATFORM</div>
      <ul class="info-list">
          <li>LOG IN TO YOUR CANDIDATE SECTION USING BELOW LINK</li>
          <li>LINK : <a href="https://certificate.molmi.info/" >https://certificate.molmi.info/</a></li>
          <li>USER ID &#8211; ${data.email}</li>
          <li>PASSWORD &#8211; ${data.password || '12345 (DEFAULT IF NOT CHANGED PREVIOUSLY)'}</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">IMPORTANT NOTES</div>
      <ul class="info-list" style="list-style: bullet; padding-left: 20px;">
          <li>CERTIFICATE WILL BE GENERATED AS PER THE REGISTERED DETAILS.</li>
          <li>KINDLY CONFIRM COURSE REGISTRATION PRIOR TO START WITH COORDINATOR.</li>
          <li>EMAIL MAY INCLUDE ATTACHMENTS FOR MOLMI GUIDELINES AND ADDITIONAL INFORMATION (IF ANY).</li>
          <li>DRESS CODE IS FORMALS WITH TIE (KINDLY ABIDE BY SAME).</li>
      </ul>
  </div>

  ${medicalAssistanceHtml}
  <div class="card">
      <div class="card-title">ASSISTANCE & QUERIES</div>
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold;">MEDICAL ASSISTANCE:</p>
      <ul class="info-list" style="margin-bottom: 16px;">
          <li><strong>CAPT. A. BANERJEE:</strong> 9967004386</li>
          <li><strong>MR. TEJINDER SINGH:</strong> 9619482177</li>
      </ul>
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold;">FURTHER QUERIES:</p>
      <ul class="info-list">
          <li><strong>MR. ADITYA:</strong> 7039393566</li>
          <li><strong>MR. RAJU:</strong> 9833179583</li>
      </ul>
  </div>

  ${(data.approveLink && data.rejectLink) ? `
  <div style="margin: 24px 0; text-align: center;">
      <p style="font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #0f172a;">Please acknowledge your enrollment by clicking one of the links below:</p>
      <p>
        <a href="${data.approveLink}" class="button button-success" style="color: white !important;">Approve</a>
        <a href="${data.rejectLink}" class="button button-danger" style="margin-left: 10px; color: white !important;">Reject</a>
      </p>
  </div>` : ''}

  <p style="font-size: 14px; color: #334155;">PLEASE CONFIRM RECEIPT OF EMAIL.</p>
  <p style="font-size: 14px; color: #334155; font-weight: bold;">WE THANK YOU FOR CONFIRMING YOUR PARTICIPATION AND LOOK FORWARD TO WELCOMING YOU TO THE TRAINING.</p>`;

  return getBaseEmailHtml(body);
};

const getWelcomeCandidateOnlineHtml = (data) => {
  const body = `
  <div class='header'>
      <h2>WELCOME TO MOLTCI (ONLINE COURSE)</h2>
  </div>
  <p style="font-size: 15px; color: #1e293b;">DEAR ${String(data.candidate_name || '').toUpperCase()},</p>
  <p style="font-size: 14px; color: #334155;">GOOD DAY,</p>
  <p style="font-size: 14px; color: #334155;">MOL TRAINING CENTRE NOMINATES YOU TO UNDERGO THE FOLLOWING TRAINING.</p>
  <p style="font-size: 15px; color: #0f172a;">WELCOME ! ABOARD! YOU HAVE BEEN SUCCESSFULLY ENROLLED IN: <strong>${String(data.course_name || '').toUpperCase()}</strong></p>
  
  <div class="card">
      <div class="card-title">COURSE DETAILS</div>
      <ul class="info-list">
          <li><strong>COURSE ID:</strong> ${data.course_id || ''}</li>
          <li>
            <strong>DURATION:</strong> ${data.duration} ${data.duration > 1 ? 'DAYS' : 'DAY'}
            (${data.start_date} to ${data.end_date})
          </li>
          <li><strong>PRIMARY TRAINER:</strong> ${!data.trainer_name ? 'Not Mentioned' : data.trainer_name}</li>
          <li><strong>COURSE START TIME:</strong> ${data.start_time || '09:30'} IST</li>
          <li><strong>COURSE END TIME:</strong> ${data.end_time || '17:30'} IST</li>
          <li style="font-size: 12px; color: #475569; font-style: italic;">*TRAINING TIME AS PER INDIAN STANDARD TIME ZONE KINDLY ADJUST AS PER YOUR LOCAL TIME ZONE.</li>
          <li><strong>TRAINING MODE:</strong> Online (VIA ${data.training_platform || 'ZOOM'} OR TEAMS)</li>
          <li><strong>ZOOM/TEAMS LINK:</strong> <a href="${data.meeting_link}">${data.meeting_link || ''}</a></li>
          <li><strong>WHATSAPP GROUP:</strong> <a href="${data.whatsapp_link}">Join here</a> to stay updated with day-to-day notifications.</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">System Requirements to Attend Training</div>
      <ul class="info-list" style="list-style: bullet; padding-left: 20px;">
          <li>DESKTOP/LAPTOP</li>
          <li>STABLE INTERNET CONNECTION</li>
          <li>MICROPHONE & EARPHONE</li>
          <li>WEBCAM</li>
          <li>PEN AND NOTEPAD</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">LOG IN REQUIREMENTS FOR CANDIDATE PLATFORM</div>
      <ul class="info-list">
          <li>LOG IN TO YOUR CANDIDATE SECTION USING BELOW LINK</li>
          <li>LINK : <a href="https://certificate.molmi.info/" >https://certificate.molmi.info/</a></li>
          <li>USER ID &#8211; ${data.email}</li>
          <li>PASSWORD &#8211; ${data.password || '12345 (DEFAULT IF NOT CHANGED PREVIOUSLY)'}</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">IMPORTANT NOTES</div>
      <ul class="info-list" style="list-style: bullet; padding-left: 20px;">
          <li>CERTIFICATE WILL BE GENERATED AS PER THE REGISTERED DETAILS.</li>
          <li>KINDLY CONFIRM COURSE REGISTRATION PRIOR TO START WITH COORDINATOR.</li>
          <li>EMAIL MAY INCLUDE ATTACHMENTS FOR MOLMI GUIDELINES AND ADDITIONAL INFORMATION (IF ANY).</li>
          <li>DRESS CODE IS FORMALS WITH TIE (KINDLY ABIDE BY SAME).</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">FOR ASSISTANCE, PLEASE CONTACT</div>
      <ul class="info-list">
          <li><strong>MR. ADITYA:</strong> 7039393566</li>
          <li><strong>MR. RAJU:</strong> 9833179583</li>
      </ul>
  </div>

  ${(data.approveLink && data.rejectLink) ? `
  <div style="margin: 24px 0; text-align: center;">
      <p style="font-weight: 600; font-size: 14px; margin-bottom: 12px; color: #0f172a;">Please acknowledge your enrollment by clicking one of the links below:</p>
      <p>
        <a href="${data.approveLink}" class="button button-success" style="color: white !important;">Approve</a>
        <a href="${data.rejectLink}" class="button button-danger" style="margin-left: 10px; color: white !important;">Reject</a>
      </p>
  </div>` : ''}

  <p style="font-size: 14px; color: #334155;">PLEASE CONFIRM RECEIPT OF EMAIL.</p>
  <p style="font-size: 14px; color: #334155; font-weight: bold;">WE THANK YOU FOR CONFIRMING YOUR PARTICIPATION AND LOOK FORWARD TO WELCOMING YOU TO THE TRAINING.</p>`;

  return getBaseEmailHtml(body);
};

const getCourseTrainerHtml = (data) => {
  const body = `
  <div class='header'>
      <h2>Course Creation</h2>
  </div>
  <p style="font-size: 15px; color: #1e293b;">Dear ${data.trainer_name},</p>
  <p style="font-size: 14px; color: #334155;">We are excited to inform you that you have been enrolled as a trainer for the following course:</p>
  
  <div class="card">
      <div class="card-title">Course Details</div>
      <ul class="info-list">
          <li><strong>Course Name:</strong> ${data.course_name}</li>
          <li><strong>Course ID:</strong> ${data.course_id}</li>
          <li><strong>Course Start Date:</strong> ${data.start_date}</li>
          <li><strong>Course End Date:</strong> ${data.end_date}</li>
          <li><strong>Duration (Days):</strong> ${data.duration}</li>
          <li><strong>Location of Training:</strong> ${data.training_location || ''}</li>
          <li><strong>WhatsApp Group Link:</strong> <a href="${data.whatsapp_group_link || '#'}">WhatsApp Link</a></li>
          <li style="margin-top: 12px;"><strong class="course-description">Course Description:</strong><br>${data.description || ''}</li>
      </ul>
  </div>

  <div style="font-size: 14px; color: #334155;">
      <p>As a trainer, your expertise will greatly benefit the candidates throughout their learning journey.</p>
      <p>Please make sure to engage with the candidates and provide them with the support they need.</p>
      <p>If you have any questions or need further information, feel free to reach out.</p>
      <p style="font-weight: bold;">Thank you for your dedication!</p>
  </div>`;
  return getBaseEmailHtml(body);
};

const getCourseCandidateHtml = (data) => {
  const body = `
  <div class='header'>
      <h2>Course Creation</h2>
  </div>
  <p style="font-size: 15px; color: #1e293b;">Dear Sir/Madam,</p>
  <p style="font-size: 14px; color: #334155;">Good Day,</p>
  <p style="font-size: 14px; color: #334155;">MOL Training Centre (Mumbai) nominates to undergo the following training ; </p>
  <p style="font-size: 15px; color: #0f172a;">Welcome aboard! You’ve been successfully enrolled in <strong>${data.course_name}</strong>.</p>
  
  <div class="card">
      <div class="card-title">Course Details</div>
      <ul class="info-list">
          <li><strong>Course ID:</strong> ${data.course_id}</li>
          <li><strong>Duration:</strong> ${data.duration} days, from <strong>${data.start_date}</strong> to <strong>${data.end_date}</strong></li>
          <li><strong>Primary Trainer:</strong> ${data.trainer_name || 'Not Mentioned'}</li>
          <li><strong>Course reporting Time:</strong> 09:15 HRS at IST , UTC – TIMING
              <ul style="list-style: none; padding-left: 15px; margin-top: 4px;">
                  <li><strong>Course start Time:</strong> 09:30 HRS at IST</li>
                  <li><strong>Course end Time:</strong> 17:30 HRS at IST</li>
              </ul>
          </li>
          <li><strong>Training Location:</strong> ${data.training_location || ''}</li>
          <li><strong>Zoom Link:</strong> ${data.zoom_link || ''}</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">Communication & Setup</div>
      <p style="margin: 0 0 12px; font-size: 14px;"><strong>WhatsApp Group:</strong> <a href="${data.whatsapp_group_link || '#'}">WhatsApp Link</a> to stay updated with day-to-day notifications.</p>
      <p style="margin: 0 0 12px; font-size: 14px;">Please join the WhatsApp group for important updates and arrive at the training location on time.</p>
      <p style="margin: 0 0 12px; font-size: 14px;">For any questions, feel free to reach out to us on same.</p>
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold;">FOR ONLINE COURSES:</p>
      <p style="margin: 0 0 8px; font-size: 14px;">Online courses will be conducted on ZOOM PRO platform. Zoom link will be sent in the welcome letter. System requirements:</p>
      <ul class="info-list" style="list-style: decimal; padding-left: 20px;">
          <li>Desktop/ Laptop</li>
          <li>Mic</li>
          <li>Earphone</li>
          <li>Web camera</li>
          <li>Pen and notepad</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">Access & Documentation</div>
      <p style="margin: 0 0 12px; font-size: 14px;">Confirm Course Registration prior to course starting. Portal link: <a href="https://certificate.molmi.info/index.php/">https://certificate.molmi.info/index.php/</a></p>
      <p style="margin: 0 0 12px; font-size: 14px;">Kindly note the certificate will be generated as per the details in the registration forms.</p>
      <p style="margin: 0 0 12px; font-size: 14px; font-weight: bold;">KINDLY NOTE: Emails will be sent with below details:</p>
      <ul class="info-list" style="list-style: bullet; padding-left: 20px;">
          <li>WELCOME LETTER with MOLMI guidelines for Zoom link, Travel, Stay (as applicable).</li>
          <li>REIMBURSEMENT FORM with MOLMI guidelines for claims.</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">Assistance & Contacts</div>
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold;">MEDICAL ASSISTANCE DURING STAY:</p>
      <ul class="info-list" style="margin-bottom: 16px;">
          <li>Capt. A. Banerjee – 9967004386</li>
          <li>Mr. Tejinder Singh - 9619482177</li>
      </ul>
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold;">FURTHER QUERIES:</p>
      <ul class="info-list">
          <li>MR. Aditya 7039393566</li>
          <li>MS. Pratima 9819558743</li>
          <li>MR. Raju 9833179583</li>
      </ul>
  </div>

  <div class="card">
      <div class="card-title">Office Address</div>
      <p style="margin: 0; font-size: 14px;">
          MOL Maritime (India) Pt. Ltd.<br>
          First Floor Deodhar Centre, Next to Sumer Plaza,<br>
          Marol Maroshi Road, Marol, Andheri (East), Pin 400059.<br>
          Tel: 022 292005007 / 022 61507092<br>
          Google Map Link: <a href="https://maps.app.goo.gl/KZ46yh5Gputy3BEe7">https://maps.app.goo.gl/KZ46yh5Gputy3BEe7</a>
      </p>
  </div>

  <p style="font-size: 14px; color: #334155; font-weight: bold;">We thank you for your confirmation for attending the course.</p>`;
  return getBaseEmailHtml(body);
};

const getTrainerForgotPasswordHtml = (data) => {
  const body = `
  <div class='header'>
      <h2>Reset Password Link</h2>
  </div>
  <div style="padding: 10px 0;">
      <p style="font-size: 15px; color: #1e293b;">Hi ${data.trainer_name},</p>
      <p style="font-size: 14px; color: #334155;">You requested to reset your password. Click the button below to reset it:</p>
      <p style="margin: 20px 0;">
          <a href="${data.reset_link}" class="button" style="color: white !important;">Reset Password</a>
      </p>
      <p style="font-size: 12px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
  return getBaseEmailHtml(body);
};

const getTrainerResetPasswordHtml = (data) => {
  const body = `
  <div class='header'>
      <h2>Password Updated Successfully</h2>
  </div>
  <div style="padding: 10px 0;">
      <p style="font-size: 15px; color: #1e293b;">Hi ${data.trainer_name},</p>
      <p style="font-size: 14px; color: #334155;">Your password has been successfully updated.</p>
  </div>`;
  return getBaseEmailHtml(body);
};

const getCandidateRegistrationHtml = (data) => {
  const resetLinkHtml = data.isSelfRegistration ? `
  <div class="card">
      <div class="card-title">Action Required</div>
      <p style="margin: 0 0 12px; font-size: 14px;">Please set your password to access your account:</p>
      <p style="margin: 16px 0 0;">
          <a href="${data.resetLink}" class="button" style="color: white !important;">Set Your Password</a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 10px;">This link will expire in 24 hours.</p>
  </div>
  ` : `
  <div class="card">
      <div class="card-title">Account Access</div>
      <p style="margin: 0; font-size: 14px;"><strong>Password:</strong> (As set by Administrator)</p>
      <p style="margin: 8px 0 0; font-size: 14px;">You can login <a href="${data.frontendUrl}/login">here</a>.</p>
  </div>
  `;

  const body = `
  <div class='header'>
      <h2>Candidate Registration</h2>
  </div>
  <p style="font-size: 15px; color: #1e293b;">Dear ${data.prefix || ''} ${data.first_name} ${data.middle_name || ''} ${data.last_name},</p>
  <p style="font-size: 14px; color: #334155;">Congratulations on your registration! We are pleased to welcome you. Below are your registration details:</p>
  
  <div class="card">
      <div class="card-title">Registration Details</div>
      <ul class="info-list">
          <li><strong>Employee ID:</strong> ${data.empId || '-'}</li>
          <li><strong>Rank Last Served on Vessel:</strong> ${data.rank || '-'}</li>
          <li><strong>Prefix:</strong> ${data.prefix || '-'}</li>
          <li><strong>Surname:</strong> ${data.last_name || '-'}</li>
          <li><strong>First Name:</strong> ${data.first_name || '-'}</li>
          <li><strong>Middle Name:</strong> ${data.middle_name || '-'}</li>
          <li><strong>Gender:</strong> ${data.gender || '-'}</li>
          <li><strong>C.D.C / Passport:</strong> ${data.cdc_passport || '-'}</li>
          <li><strong>Vessel Type:</strong> -</li>
          <li><strong>Vessel Name:</strong> -</li>
          <li><strong>Birth Date:</strong> ${data.dob || '-'}</li>
          <li><strong>Nationality:</strong> ${data.nationality || '-'}</li>
          <li><strong>Seaman Book No.:</strong> -</li>
          <li><strong>WhatsApp Number:</strong> ${data.whatsapp || '-'}</li>
          <li><strong>Alternate Number:</strong> ${data.alternate_mobile || '-'}</li>
      </ul>
  </div>
  
  <div class="card">
      <div class="card-title">Account Credentials</div>
      <p style="margin: 0; font-size: 14px;"><strong>Email Address:</strong> ${data.email}</p>
  </div>
  ${resetLinkHtml}
  
  <p style="font-size: 14px; color: #334155;">Please review your details carefully. If you notice any discrepancies or have any questions, don’t hesitate to reach out.</p>
  <p style="font-size: 14px; color: #334155; font-weight: bold;">We look forward to supporting you on your maritime journey!</p>`;
  return getBaseEmailHtml(body);
};

module.exports = {
  getBaseEmailHtml,
  getWelcomeCandidateOfflineHtml,
  getWelcomeCandidateOnlineHtml,
  getCourseTrainerHtml,
  getCourseCandidateHtml,
  getTrainerForgotPasswordHtml,
  getTrainerResetPasswordHtml,
  getCandidateRegistrationHtml,
};
