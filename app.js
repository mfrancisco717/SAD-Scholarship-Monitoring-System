
/* Scholarship Monitoring System - browser client.
   Uses only the Supabase publishable/anon key. Database RLS is required. */

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;
let programCache = [];
let submissionCache = [];

const $ = (id) => document.getElementById(id);

const show = (id, yes = true) =>
  $(id).classList.toggle("hidden", !yes);

function notice(message, isError = false) {
  const box = $("notice");
  box.textContent = message;
  box.classList.remove("hidden", "error");

  if (isError) box.classList.add("error");
}

function clearNotice() {
  $("notice").classList.add("hidden");
}

function errMessage(error) {
  return error?.message || String(error || "Unknown error");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function configure(url, key) {
  url = url.trim();
  key = key.trim();

  if (!url.startsWith("https://") || !key) {
    throw new Error(
      "Enter a valid HTTPS project URL and publishable/anon key."
    );
  }

  supabaseClient = window.supabase.createClient(url, key);

  localStorage.setItem("scholarship_supabase_url", url);
  localStorage.setItem("scholarship_supabase_key", key);

  show("setupPanel", false);
  show("authPanel", true);

  notice("Supabase client configured. Sign in or create a scholar account.");
}

$("saveConfigBtn").addEventListener("click", () => {
  try {
    configure(
      $("projectUrl").value,
      $("publishableKey").value
    );
  } catch (error) {
    notice(errMessage(error), true);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) return notice(error.message, true);

  currentUser = null;
  currentProfile = null;

  show("appPanel", false);
  show("authPanel", true);
  show("logoutBtn", false);

  notice("You have signed out.");
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
      });

    if (error) return notice(error.message, true);

    await loadSession(data.user);
  } catch (error) {
    notice(errMessage(error), true);
  }
});

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const fullName = $("signupName").value.trim();
  const studentId = $("signupStudentId").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          student_id: studentId
        }
      }
    });

    if (error) return notice(error.message, true);

    if (!data.user) {
      return notice(
        "Account request created. Check the email instructions from Supabase."
      );
    }

    if (!data.session) {
      return notice(
        "Account created. Confirm your email, then sign in. " +
        "Your profile will be created by the database trigger."
      );
    }

    await loadSession(data.user);
  } catch (error) {
    notice(errMessage(error), true);
  }
});

async function loadSession(user) {
  currentUser = user;

  const { data: profile, error } = await supabaseClient
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return notice("Could not load your profile: " + error.message, true);
  }

  if (!profile) {
    return notice(
      "Your profile has not been created yet. Confirm your email if required, " +
      "then sign out and sign in again. Ask staff to check the profile trigger " +
      "if it persists.",
      true
    );
  }

  currentProfile = profile;

  show("authPanel", false);
  show("appPanel", true);
  show("logoutBtn", true);

  $("welcomeTitle").textContent = "Welcome, " + profile.full_name;
  $("welcomeText").textContent =
    "Role: " + profile.role + " · Account: " + profile.email;

  show("scholarPanel", profile.role === "scholar");
  show("staffPanel", profile.role === "staff");

  if (profile.role === "staff") {
    await loadStaff();
  } else {
    await loadScholar();
  }
}

async function loadPrograms() {
  const { data, error } = await supabaseClient
    .from("scholarship_programs")
    .select("*")
    .order("program_name");

  if (error) throw error;

  programCache = data || [];

  const opts = programCache.map((program) =>
    `<option value="${program.program_id}">` +
    `${escapeHtml(program.program_name)}</option>`
  ).join("");

  $("assignProgram").innerHTML =
    '<option value="">Select program</option>' + opts;

  $("programFilter").innerHTML =
    '<option value="">All programs</option>' + opts;
}

async function loadScholar() {
  const { data, error } = await supabaseClient
    .from("semester_submissions")
    .select(
      "*, scholar_assignments!inner(user_id, scholarship_programs(program_name))"
    )
    .eq("scholar_assignments.user_id", currentUser.id)
    .order("submitted_at", { ascending: false });

  if (error) return notice(error.message, true);

  renderMySubmissions(data || []);
}

function renderMySubmissions(rows) {
  if (!rows.length) {
    $("mySubmissions").innerHTML =
      "<p class='muted'>No submissions yet.</p>";
    return;
  }

  $("mySubmissions").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Academic period</th>
          <th>GWA</th>
          <th>Program</th>
          <th>Verification</th>
          <th>Compliance</th>
          <th>Renewal</th>
          <th>Reasons</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.academic_year)} / ${escapeHtml(row.semester)}</td>
            <td>${Number(row.gwa).toFixed(2)}</td>
            <td>${escapeHtml(
              row.scholar_assignments?.scholarship_programs?.program_name || ""
            )}</td>
            <td>${escapeHtml(row.verification_status)}</td>
            <td>${escapeHtml(row.compliance_result || "Pending")}</td>
            <td>${escapeHtml(row.renewal_decision || "Not decided")}</td>
            <td>${escapeHtml(row.deficiency_reasons || "—")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

$("submissionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const gwa = Number($("gwa").value);
  const units = Number($("units").value);
  const failed = Number($("failedCount").value);
  const incomplete = Number($("incompleteCount").value);
  const dropped = Number($("droppedCount").value);

  if (!Number.isFinite(gwa) || gwa < 1 || gwa > 5) {
    return notice("GWA must be between 1.00 and 5.00.", true);
  }

  if ([units, failed, incomplete, dropped].some(
    (number) => !Number.isInteger(number) || number < 0
  )) {
    return notice(
      "Units and subject counts must be nonnegative whole numbers.",
      true
    );
  }

  const { data: assignment, error: assignmentError } =
    await supabaseClient
      .from("scholar_assignments")
      .select("assignment_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

  if (assignmentError) return notice(assignmentError.message, true);

  if (!assignment) {
    return notice(
      "No scholarship program is assigned to your account yet. Ask staff to assign one.",
      true
    );
  }

  const { error } = await supabaseClient
    .from("semester_submissions")
    .insert({
      assignment_id: assignment.assignment_id,
      academic_year: $("academicYear").value.trim(),
      semester: $("semester").value,
      gwa,
      enrolled_units: units,
      failed_count: failed,
      incomplete_count: incomplete,
      dropped_count: dropped,
      evidence_reference: $("evidenceReference").value.trim()
    });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return notice(
        "A submission already exists for this academic year and semester.",
        true
      );
    }

    return notice(error.message, true);
  }

  $("submissionForm").reset();
  $("academicYear").value = "2026-2027";

  notice("Submission saved and set to Pending verification.");
  await loadScholar();
});

async function loadStaff() {
  try {
    await loadPrograms();
  } catch (error) {
    return notice("Could not load programs: " + error.message, true);
  }

  await refreshStaffSubmissions();
}

$("refreshBtn").addEventListener("click", refreshStaffSubmissions);
$("searchInput").addEventListener("input", renderStaffSubmissions);
$("programFilter").addEventListener("change", renderStaffSubmissions);
$("complianceFilter").addEventListener("change", renderStaffSubmissions);

async function refreshStaffSubmissions() {
  const { data, error } = await supabaseClient
    .from("semester_submissions")
    .select(
      "*, scholar_assignments!inner(user_id, scholarship_programs(program_name), user_profiles!scholar_assignments_user_id_fkey(full_name,student_id,email))"
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    notice("Loading staff submissions failed: " + error.message, true);
    return false;
  }

  submissionCache = data || [];

  const uniqueScholars = new Set(
    submissionCache.map((submission) => submission.assignment_id)
  );

  $("statAssigned").textContent = uniqueScholars.size;

  $("statPending").textContent = submissionCache.filter(
    (submission) =>
      submission.verification_status === "Pending verification"
  ).length;

  $("statCompliant").textContent = submissionCache.filter(
    (submission) => submission.compliance_result === "Compliant"
  ).length;

  $("statDeficient").textContent = submissionCache.filter(
    (submission) => submission.compliance_result === "With Deficiency"
  ).length;

  renderStaffSubmissions();
  return true;
}

function renderStaffSubmissions() {
  const query = $("searchInput").value.trim().toLowerCase();
  const selectedProgram = $("programFilter").value;
  const selectedCompliance = $("complianceFilter").value;

  const rows = submissionCache.filter((row) => {
    const profile = row.scholar_assignments?.user_profiles || {};
    const name = (profile.full_name || "").toLowerCase();
    const studentId = (profile.student_id || "").toLowerCase();

    const matchesSearch =
      !query || name.includes(query) || studentId.includes(query);

    const programName =
      row.scholar_assignments?.scholarship_programs?.program_name;

    const selectedProgramName = programCache.find(
      (program) => program.program_id === selectedProgram
    )?.program_name;

    const matchesProgram =
      !selectedProgram || programName === selectedProgramName;

    const matchesCompliance =
      !selectedCompliance ||
      (selectedCompliance === "Pending"
        ? !row.compliance_result
        : row.compliance_result === selectedCompliance);

    return matchesSearch && matchesProgram && matchesCompliance;
  });

  if (!rows.length) {
    $("staffSubmissions").innerHTML =
      "<p class='muted'>No matching submissions.</p>";
    return;
  }

  $("staffSubmissions").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Scholar</th>
          <th>Period / Program</th>
          <th>Summary</th>
          <th>Status</th>
          <th>Reasons</th>
          <th>Staff actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const profile = row.scholar_assignments?.user_profiles || {};
          const verified = row.verification_status === "Verified";

          return `
            <tr>
              <td>
                ${escapeHtml(profile.full_name || "Unknown")}
                <br>
                <span class="muted">
                  ${escapeHtml(profile.student_id || profile.email || "")}
                </span>
              </td>
              <td>
                ${escapeHtml(row.academic_year)} / ${escapeHtml(row.semester)}
                <br>
                ${escapeHtml(
                  row.scholar_assignments?.scholarship_programs?.program_name || ""
                )}
              </td>
              <td>
                GWA ${Number(row.gwa).toFixed(2)}
                <br>
                Units ${row.enrolled_units};
                failed ${row.failed_count};
                INC ${row.incomplete_count};
                dropped ${row.dropped_count}
                <br>
                <span class="muted">
                  Evidence: ${escapeHtml(row.evidence_reference)}
                </span>
              </td>
              <td>
                ${escapeHtml(row.verification_status)}
                <br>
                ${escapeHtml(row.compliance_result || "Not evaluated")}
                <br>
                ${escapeHtml(row.renewal_decision || "No decision")}
              </td>
              <td>${escapeHtml(row.deficiency_reasons || "—")}</td>
              <td class="actions">
                ${!verified ? `
  <button type="button" class="btn-success"
    data-action="verify" data-id="${row.submission_id}">
    Verify
  </button>
  <button type="button" class="btn-danger"
    data-action="return" data-id="${row.submission_id}">
    Return
  </button>
` : ""}
<button type="button" class="btn-info"
  data-action="evaluate" data-id="${row.submission_id}">
  Evaluate
</button>
<button type="button" class="btn-success"
  data-action="approve" data-id="${row.submission_id}">
  Approve
</button>
<button type="button" class="btn-warning"
  data-action="hold" data-id="${row.submission_id}">
  Hold
</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

/* UPDATED STAFF ACTION HANDLER */
$("staffSubmissions").addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  console.log("Staff action clicked:", action);

  const row = submissionCache.find(
    (submission) =>
      String(submission.submission_id) === btn.dataset.id
  );

  if (!row) {
    return notice("Submission not found. Click Refresh and try again.", true);
  }

  console.log("Selected submission:", row.submission_id);

  let reason = "";
  let notes = "";

  if (action === "return" || action === "hold") {
    reason = prompt(
      action === "return"
        ? "Reason for returning evidence:"
        : "Reason for holding renewal:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      return notice("A reason is required.", true);
    }
  }

  if (action === "approve") {
    notes = prompt("Optional approval note:") || "";
  }

  try {
    btn.disabled = true;
    clearNotice();

    let result;

    if (action === "verify") {
      result = await supabaseClient.rpc("verify_submission", {
        p_submission_id: row.submission_id,
        p_verified: true,
        p_reason: "Evidence checked by staff"
      });
    } else if (action === "return") {
      result = await supabaseClient.rpc("verify_submission", {
        p_submission_id: row.submission_id,
        p_verified: false,
        p_reason: reason.trim()
      });
    } else if (action === "evaluate") {
      console.log("Calling evaluate_compliance RPC...");

      result = await supabaseClient.rpc("evaluate_compliance", {
        p_submission_id: row.submission_id
      });

      console.log("Evaluation RPC response:", result);
      console.log("Evaluation data:", result?.data);
      console.log("Evaluation error:", result?.error);
    } else if (action === "approve" || action === "hold") {
      result = await supabaseClient.rpc("record_renewal_decision", {
        p_submission_id: row.submission_id,
        p_decision: action === "approve" ? "Approved" : "Held",
        p_notes: action === "hold" ? reason.trim() : notes
      });
    } else {
      return notice("Unknown staff action: " + action, true);
    }

    if (result?.error) {
      console.error("Supabase action error:", result.error);

      return notice(
        "Action failed: " + result.error.message,
        true
      );
    }

    console.log("Staff action result:", result?.data);

    const refreshed = await refreshStaffSubmissions();

    if (!refreshed) {
      return;
    }

    const updatedRow = submissionCache.find(
      (submission) =>
        String(submission.submission_id) === String(row.submission_id)
    );

    if (action === "evaluate" && updatedRow) {
      console.log("Updated submission after evaluation:", updatedRow);

      notice(
        "Evaluation request completed. Current result: " +
        (updatedRow.compliance_result || "Pending") +
        ". Verification: " +
        (updatedRow.verification_status || "Unknown") +
        ". Renewal decision: " +
        (updatedRow.renewal_decision || "Not decided") +
        "."
      );
    } else {
      notice("Action completed successfully.");
    }
  } catch (error) {
    console.error("Staff action exception:", error);

    notice("Action failed: " + errMessage(error), true);
  } finally {
    btn.disabled = false;
  }
});

$("assignmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();

  const userId = $("assignUserId").value.trim();
  const programId = $("assignProgram").value;

  if (!userId) {
    return notice("Enter the scholar's user UUID.", true);
  }

  if (!programId) {
    return notice("Select a scholarship program.", true);
  }

  try {
    const { error } = await supabaseClient
      .from("scholar_assignments")
      .upsert(
        {
          user_id: userId,
          program_id: programId
        },
        { onConflict: "user_id" }
      );

    if (error) return notice(error.message, true);

    notice("Scholarship program assigned.");
    $("assignmentForm").reset();

    await refreshStaffSubmissions();
  } catch (error) {
    notice(errMessage(error), true);
  }
});

async function start() {
  const url = localStorage.getItem("scholarship_supabase_url");
  const key = localStorage.getItem("scholarship_supabase_key");

  if (url && key) {
    $("projectUrl").value = url;
    $("publishableKey").value = key;

    try {
      configure(url, key);

      const {
        data: { session }
      } = await supabaseClient.auth.getSession();

      if (session?.user) {
        await loadSession(session.user);
      }
    } catch (error) {
      notice(errMessage(error), true);
    }
  }
}

start();
