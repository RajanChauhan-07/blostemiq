variable "environment" { type = string }
variable "services"    { type = list(string) }

resource "aws_ecr_repository" "services" {
  for_each             = toset(var.services)
  name                 = "blostemiq-${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true   # Free vulnerability scanning
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Service = each.value }
}

# Lifecycle: Keep only last 10 images per repo (saves storage costs)
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = toset(var.services)
  repository = aws_ecr_repository.services[each.value].name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
