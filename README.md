# Student Scholarship Monitoring and Academic Compliance System

Starter project for the ITPC111 / Systems Analysis and Design laboratory exam.

## Files
- `index.html`: UI structure
- `style.css`: responsive styling
- `app.js`: Supabase browser client and screens
- `supabase.sql`: schema, RLS policies, RPC functions, and two fictional policy records

## Setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase.sql` in a new project.
3. In Project Connect / API Keys, copy the Project URL and publishable key (or legacy anon key).
4. Open `index.html` in a browser, enter those two values, and connect.
5. Create a scholar account using the sign-up form. If email confirmation is enabled, confirm it before signing in.
6. In Supabase Authentication -> Users, find the UUID for a staff account you created and signed up with.
7. In SQL Editor, run:
   `update public.user_profiles set role='staff' where user_id='YOUR-STAFF-USER-UUID';`
   Only do this for the intended staff account.
8. Sign in as staff. Assign a scholarship program to a scholar using the scholar's Auth UUID.
9. Sign in as that scholar and submit a test semester record.

## Security notes
- Browser code uses only the publishable/anon key.
- Never place the database password, secret key, or service-role key in `app.js`.
- Database Row Level Security is enabled; privileged changes use staff-checked database functions.
- Test the role access rules using separate accounts. Review all policies before using real data.

## Important known limitations to review before submission
- This is a starter, not a certified production system.
- The exam asks for six fictional scholar records. Create six synthetic accounts, assign each to a program, and enter the exact values from the exam table to demonstrate TC01-TC06.
- The starter's dashboard totals are derived from submissions and may need adjustment to count all assigned scholars even if they have no submissions.
- The UI currently returns evidence and logs the reason, but does not expose an edit/resubmit form for returned submissions. Add that workflow to fully meet TC09.
- The browser assignment screen expects a scholar Auth UUID, which is available in Authentication -> Users.
- Run all ten tests and record actual results honestly. Do not mark a test passed without observing it.
- Verify the staff list query against your Supabase relationship names if the generated foreign-key name differs.
- Instructor requirements and permitted resources take precedence over this starter.

## Local use
You can open `index.html` directly in a modern browser with an internet connection. If your browser blocks scripts when opening local files, run a local static server (for example, VS Code Live Server).
