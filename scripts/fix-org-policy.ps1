# DEBUG: Script to update organization policy to allow public bucket access

# Get your organization ID
gcloud organizations list

# Set the organization ID (replace with your actual org ID from above)
$ORG_ID = "423171482239"  # Your org ID from .env.local

# Create policy allowing allUsers
@"
constraint: constraints/iam.managed.allowedPolicyMembers
listPolicy:
  allowedValues:
  - allUsers
  - allAuthenticatedUsers
  - principalSet://goog/subject/*
  - principalSet://goog/public:all
"@ | Out-File -FilePath org-policy.yaml -Encoding UTF8

# Apply the policy
gcloud org-policies set-policy org-policy.yaml --organization=$ORG_ID

# Verify the policy was applied
gcloud org-policies describe constraints/iam.managed.allowedPolicyMembers --organization=$ORG_ID