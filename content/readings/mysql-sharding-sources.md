---
title: "MySQL 分库分表场景资料导读"
category: "MySQL"
tags: ["分库分表"]
type: article
learning_status: pending
created_at: "2026-10-19 22:32:18"
updated_at: "2026-10-20 10:44:42"
source:
  - "https://dev.mysql.com/doc/refman/8.4/en/optimize-blob.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/memory-use.html"
  - "https://vitess.io/docs/23.0/user-guides/vschema-guide/sharding-guidelines/"
  - "https://vitess.io/docs/23.0/user-guides/vschema-guide/unique-lookup/"
  - "https://vitess.io/docs/23.0/reference/features/vindexes/"
  - "https://vitess.io/docs/23.0/reference/vreplication/materialize/"
---

MySQL 8.4 手册说明大字段拆表与实例资源的边界；Vitess 23.0 的资料进一步展示，如何根据主要访问关系分片，再用路由映射或另一份查询数据适配其他查询。「**定位数据所在分片与改变数据的组织方式，是不同的优化**」。本篇节选与拆分场景和多维查询有关的内容，未做性能实测。

## 宽表与大字段

MySQL 的 [BLOB 优化说明](https://dev.mysql.com/doc/refman/8.4/en/optimize-blob.html)建议：如果查询不需要 BLOB 列，可以考虑把该列放入独立表，需要时再通过 JOIN 读取，以降低这些查询的内存需求。大字段的访问要求不同，也可以把对应表放在另一存储设备或数据库实例。

这为按访问模式垂直拆表提供了具体场景：常用字段留在主表，低频大字段独立存储。收益取决于查询是否经常需要这些字段，以及拆开后的关联读取成本，不能仅凭字段数量判断一定需要拆表。

## 表的规模与实例资源

MySQL 的[内存使用说明](https://dev.mysql.com/doc/refman/8.4/en/memory-use.html)指出，InnoDB 缓冲池缓存表和索引等数据，由服务器分配，并通过 `innodb_buffer_pool_size` 控制大小；多个表的数据使用这套缓存资源。

由此可以推导：同一实例内增加表的数量，不会增加一套独立的实例资源。要分散实例级负载，需要把数据分布到多个实例，并配置相应资源；如果多个实例仍争用同一主机或存储，也可能继续受同一硬件瓶颈限制。

## 从业务拆库到水平分片

Vitess 的[分片指南](https://vitess.io/docs/23.0/user-guides/vschema-guide/sharding-guidelines/)先介绍把部分表迁往其他数据库，按业务边界拆开；当表之间关系很强、继续按表分开不合适时，再讨论通过分片键把记录分布到不同分片。

选择分片键时，指南从主要查询模式出发，并把关联关系和事务边界纳入判断。例如，把客户及其订单放在同一分片，便于查询该客户的订单，也有助于让事务留在单片。其他查询条件可能需要辅助路由索引；如果要求跨片原子提交，则需要额外的协调机制。

指南同时指出，大租户可能超过单片容量，需要更细粒度的分片键。因此，拆分方式需要结合数据之间的关系、访问方式和增长情况决定，不能只追求平均分配记录数量。

## 路由映射补充查询入口

Vitess 的 [Unique Lookup 用例](https://vitess.io/docs/23.0/user-guides/vschema-guide/unique-lookup/)中，订单按客户 ID 分片，只用订单号查询原本需要广播到所有分片。用例增加了订单号到 `keyspace_id` 的映射，后者用于确定目标分片。查询变成先查映射、再查订单的两次单片访问，减少广播。

用例通过 `owner` 配置随订单变更自动维护映射；`consistent_lookup_unique` 使用特定提交顺序，处理部分提交带来的一致性风险。这是具体实现提供的保障，自建映射也必须设计相应的一致性维护。

[Vindexes 说明](https://vitess.io/docs/23.0/reference/features/vindexes/)区分主分片与辅助路由：主 Vindex 决定记录放在哪里，辅助 Vindex 帮助其他条件定位一个或多个分片，但分片内仍需普通 MySQL 索引。由此可推导，地区映射如果指向很多分片，查询依然需要跨片执行、归并；映射不会把地区订单重新集中存放。

## 多维高频查询与物化数据

分片指南在多种强访问关系难以同时共置时，提出按另一种关系维护物化数据。[Materialize](https://vitess.io/docs/23.0/reference/vreplication/materialize/)提供持续维护目标表的机制，支持单表字段投影、过滤以及部分聚合，目标数据近实时同步；工作流进入 `Replicating` 后再开始访问目标数据。这不表示任意 SQL 都支持，也不保证源表提交后目标立即可见。

据此用于订单场景，可以把业务写入保留在按用户分片的源表，再维护一份按地区组织、包含后台所需字段的查询数据；这是由官方机制归纳出的设计方式。用户查询走源表，地区查询走另一份数据，目标表仍需配置相应分片规则和索引。

这种组织方式用额外存储与同步维护换取查询便利。需要完整详情时，还要确定是否回查源表；要求立即读到最新结果时，不能仅依赖近实时查询副本。具体分片配置、同步延迟和查询收益均未实测。
