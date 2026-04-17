output "endpoint"          { value = aws_elasticache_cluster.redis.cache_nodes[0].address }
output "port"              { value = aws_elasticache_cluster.redis.port }
output "security_group_id" { value = aws_security_group.redis.id }
