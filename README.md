# Student Scholarship Monitoring and Academic Compliance System

## Project Overview

The Student Scholarship Monitoring and Academic Compliance System is a web-based application designed to help monitor scholars' academic performance and scholarship requirements. It allows scholarship staff to manage scholar assignments, verify submitted academic evidence, evaluate compliance with scholarship policies, and record scholarship renewal decisions.

The system also allows scholars to submit their academic information and supporting evidence for evaluation.

## Objectives

- To monitor scholars' academic performance and scholarship requirements.
- To allow scholars to submit academic information and supporting evidence.
- To help scholarship staff verify submitted evidence.
- To automatically evaluate compliance based on scholarship policies.
- To record scholarship renewal decisions and maintain evaluation history.
- To improve the accuracy and organization of scholarship monitoring records.

## Key Features

### Scholar Features
- Register and log in to the system.
- View assigned scholarship information.
- Submit academic information and supporting evidence.
- View submission status and compliance results.
- Correct and resubmit returned submissions when allowed.

### Scholarship Staff Features
- View and manage assigned scholars.
- Assign scholars to scholarship programs.
- Verify submitted academic evidence.
- Evaluate academic compliance.
- View deficiency reasons when requirements are not met.
- Approve compliant scholars or place deficient applications on hold.
- Track submission and decision history.

### Compliance Evaluation
The system evaluates scholars based on their scholarship program requirements, including GWA, enrolled units, failed subjects, incomplete grades, dropped subjects, and submission deadlines.

**Merit Scholar Requirements**
- Maximum GWA: 1.75
- Minimum enrolled units: 18
- Allowed failed subjects: 0
- Allowed incomplete grades: 0
- Allowed dropped subjects: 0

**Community Scholar Requirements**
- Maximum GWA: 2.25
- Minimum enrolled units: 15
- Allowed failed subjects: 0
- Allowed incomplete grades: 0
- Allowed dropped subjects: 1

**Submission Deadline:** October 30, 2026, at 5:00 PM Philippine time. Submissions received exactly at the deadline are considered on time.

Evidence must be verified before compliance evaluation. Scholarship renewal approval is permitted only when the scholar meets the applicable requirements.

## Technologies Used

- HTML — webpage structure
- CSS — layout and styling
- JavaScript — application logic and interactions
- Supabase — authentication, database, and access control
- GitHub — source code repository
- GitHub Pages — website hosting

## User Roles

**1. Scholar**

The scholar submits academic information and supporting evidence, checks compliance results, and responds to returned submissions.

**2. Scholarship Staff**

Scholarship staff manage scholar assignments, verify evidence, evaluate compliance, and record renewal decisions.

## System Workflow

1. The user logs in using the appropriate account.
2. Scholarship staff assign the scholar to a scholarship program.
3. The scholar submits academic information and supporting evidence.
4. Scholarship staff verify the submitted evidence.
5. The system evaluates the scholar's compliance with the assigned program's requirements.
6. The system displays the compliance status and any deficiency reasons.
7. Scholarship staff record the renewal decision.
8. The system maintains submission and decision history.

## Database

The system uses Supabase to store and manage application data. The database design includes records for user profiles, scholarship programs and policy thresholds, scholar assignments, submissions, evaluation results, and renewal decisions or history.

Database access is controlled through the application's authorization rules and Supabase Row Level Security policies.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/mfrancisco717/SAD-Scholarship-Monitoring-System.git
```

### 2. Open the Project

Open the downloaded project folder in Visual Studio Code.

### 3. Configure Supabase

Create or use a Supabase project and configure the required database tables, functions, authentication, and access policies.

Update the Supabase project URL and publishable key in the application configuration as required.

**Security reminder:** Never place a Supabase service-role key, database password, or other private credentials in frontend code or a public repository.

### 4. Run the Application Locally

Open `index.html` in a browser or use the Live Server extension in Visual Studio Code.

Some authentication and database functions require a correctly configured Supabase connection.

## Deployment

The frontend can be hosted using GitHub Pages.

Repository: https://github.com/mfrancisco717/SAD-Scholarship-Monitoring-System

Live System: https://mfrancisco717.github.io/SAD-Scholarship-Monitoring-System/

The live application requires a working Supabase configuration for authentication and database operations.

## Testing

The system should be tested for the following:

- Compliance at policy boundaries.
- GWA and enrolled-unit requirements.
- Multiple deficiency reasons.
- Submission deadline handling.
- Evidence verification before evaluation.
- Duplicate and invalid submissions.
- Scholar and staff access restrictions.
- Returning, correcting, and resubmitting evidence.
- Renewal approval and hold decisions.
- Audit and decision history.

Actual test results and screenshots should be documented based on the behavior observed in the running system.

## Project Purpose

This project was developed as an academic requirement for Systems Analysis and Design. It demonstrates the analysis, design, implementation, testing, and deployment of a scholarship monitoring and academic compliance system.

## Author

**Name:** Micah Babe S. Francisco  
**Course/Year/Section:** BSIT-3A  
**Project:** Student Scholarship Monitoring and Academic Compliance System

## License

This project was developed for educational purposes.
