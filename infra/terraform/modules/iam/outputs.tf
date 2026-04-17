output "github_actions_role_arn" { value = aws_iam_role.github_actions.arn }
output "auth_service_role_arn"   { value = aws_iam_role.auth_service.arn }
output "partner_service_role_arn" { value = aws_iam_role.partner_service.arn }
output "ml_serving_role_arn"     { value = aws_iam_role.ml_serving.arn }
