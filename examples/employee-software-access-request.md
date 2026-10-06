# Employee Software Access Request — Test Case

**Process Name:** Employee Software Access Request  
**Business Objective:** Provide employees access to approved software quickly while maintaining manager approval and security controls.  
**Trigger:** An employee submits a software access request.  
**End:** Access is granted or the request is rejected and documented.

## Process Steps

1. Employee submits a software access request in the service portal.
2. Manager reviews and approves or rejects the request.
3. Approved requests enter the IT Service Desk queue.
4. Service Desk manually checks whether the employee already has a license and whether the requested software is approved.
5. If information is missing, the Service Desk sends the request back to the employee for clarification.
6. Service Desk manually emails the Security team for approval when the software requires elevated access.
7. Security reviews the request and responds by email.
8. Service Desk updates the ticket manually with the Security decision.
9. If approved, Service Desk assigns the request to the Application Support team.
10. Application Support provisions the software.
11. Service Desk confirms access with the employee and closes the ticket.

## Known Bottlenecks

- **Bottleneck 1 — Step 4:** Manual license and software-approval checks take time and are repeated for many requests.
- **Bottleneck 2 — Steps 6–8:** Security approval is handled through email, creating waiting time and manual ticket updates.

## Current Metrics

- About 60 requests per day.
- Average completion time: 2 business days.
- About 15% of requests are returned because required information is missing.
- Security-related requests can wait 4–6 hours for approval.

## Controls That Must Remain

- Manager approval.
- Security approval for elevated-access software.
- Audit trail of approvals.
- Final access confirmation.

## Prompt

> Analyze this process, identify the bottlenecks, create the AS-IS and TO-BE process flows, and recommend improvements while preserving the required controls.
