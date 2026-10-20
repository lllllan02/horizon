---
title: "数据同步方案官方资料导读"
category: "数据处理"
tags: ["数据同步"]
type: article
learning_status: pending
created_at: "2026-10-20T11:09:10+08:00"
updated_at: "2026-10-20T15:34:08+08:00"
source:
  - "https://debezium.io/documentation/reference/stable/connectors/mysql.html"
  - "https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/fault_tolerance/"
  - "https://doris.apache.org/docs/3.x/ecosystem/flink-doris-connector/"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-redo-log.html"
  - "https://github.com/alibaba/canal"
  - "https://dev.mysql.com/doc/refman/8.4/en/binary-log.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/replication-formats.html"
  - "https://kafka.apache.org/40/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/replication-gtids-concepts.html"
  - "https://docs.pingcap.com/tidb/stable/sync-diff-inspector-overview/"
---

MySQL、Canal、Debezium、Kafka、Flink、Doris 和 PingCAP 的官方资料分别解释全量导出、数据捕获、失败恢复、目标落地与数据校验。「**全量与增量要衔接，重放与目标写入也要协调**」：捕获到变更，不代表目标已经正确保存。本篇节选与 MySQL 数据同步设计有关的内容，依据 2026-10-20 阅读的 MySQL 8.4、Kafka 4.0 Consumer Javadoc、Doris 3.x、Canal README，以及 Debezium、Flink 与 PingCAP 滚动文档，未做链路实测。

## CDC 与日志订阅

CDC（Change Data Capture，变更数据捕获）关注捕获数据变化并交给下游处理。在 MySQL 中，Binlog 是可用的变化来源：[二进制日志说明](https://dev.mysql.com/doc/refman/8.4/en/binary-log.html)指出，它包含建表等结构变化及数据修改事件，不仅是新增、更新和删除；[复制格式说明](https://dev.mysql.com/doc/refman/8.4/en/replication-formats.html)区分语句与行格式，其中行格式记录行怎样改变。具体 CDC 工具对日志格式和行信息有自己的要求，不能把所有 Binlog 都理解成完整的 SQL 文本或完整行镜像。

[Canal README 的“工作原理”](https://github.com/alibaba/canal#工作原理)给出日志订阅过程：Canal 模拟 MySQL 从库的协议交互，发送日志读取请求，MySQL 推送 Binlog，Canal 再解析收到的二进制流。因此，“订阅”通过复制机制持续获取事件，不需要业务代码逐次通知采集器。README 同时区分服务端解析与客户端消费，支持将变更发送到消息队列；从消费到目标写入仍需相应程序或连接器完成。

这里借 Canal 解释机制，不据此确认具体部署兼容性：本次 README 列出的 MySQL 支持版本到 8.0.x，不能由 MySQL 8.4 手册与该机制说明推断 Canal 已验证兼容 8.4。Debezium 的 MySQL 连接器同样从 Binlog 捕获变化，具体日志格式、权限与恢复坐标应按采用的版本核对。

## 全量初始化与一致快照

[InnoDB 一致性读取](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html)说明，可重复读隔离级别下，同一事务内的普通一致性读取复用首次读取建立的快照。其他连接仍可修改数据，读取者通过历史版本看到自己快照中的状态。因此快照是一套固定可见性的读取规则，不是在事务开始时立即生成整库副本；扫描、导出和导入仍然需要实际执行。

[mysqldump 的 `--single-transaction`](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html#option_mysqldump_single-transaction)设置可重复读隔离级别并开启事务，以一致性读取导出 InnoDB 表；`--quick` 可以逐行获取结果，避免客户端先缓存整张表。该一致性保证不覆盖 MyISAM、MEMORY 等非事务表；导出期间相关 DDL 也可能破坏导出的正确性，不能只根据用了事务参数就认为任何表、任何操作都安全。

同页 `--source-data` 说明：值为 `2` 时，把对应的 Binlog 文件名和位置作为注释写入导出文件。与 `--single-transaction` 配合时，开始阶段仍会短暂取得全局读锁，以协调数据状态和日志坐标；不能用导出结束时另外查询的坐标代替。文件成功导出后可以结束源端事务，随后导入目标，但导入文件本身不会启动 CDC，目标仍需接收并应用后续变更。

## 长时间快照的代价

[Purge 官方说明](https://dev.mysql.com/doc/refman/8.4/en/innodb-purge-configuration.html)在 “Configuring the Maximum Purge Lag” 中指出：即使只读，长事务也可能使 `History list length` 增长，并直接以存在大量并发修改的 `mysqldump --single-transaction` 为例。原因是快照需要读取过去的状态，MVCC 必须保留仍被依赖的 Undo 历史，直到相关事务结束。例如导出快照中的订单未支付，随后业务支付成功，导出仍需借助 Undo 还原未支付状态；修改事务提交不代表这些历史信息立刻可以清理。

因此，导出耗时与并发更新、删除共同影响历史积压，需要关注 Undo 空间、清理积压和扫描负载。`History list length` 是历史积压指标，不能直接当作字节数或数据行数。分批读取可以控制单次结果量，但只要仍在同一快照事务里，就不能据此消除长快照的代价；每批重新开事务又会改变可见性，不能直接宣称取得同一时点的数据。

[Redo 官方说明](https://dev.mysql.com/doc/refman/8.4/en/innodb-redo-log.html)指出，Redo 随数据修改追加，主要用于崩溃恢复，旧记录随 Checkpoint 推进回收。据此应区分：快照对旧版本的依赖会延迟相应 Undo 历史清理，并不直接要求保留从快照开始以来的全部 Redo。导出造成 I/O 竞争、进而影响刷脏，是可能的间接影响，具体程度需结合实际负载验证。

## 全量与增量衔接

[Debezium MySQL 连接器](https://debezium.io/documentation/reference/stable/connectors/mysql.html#mysql-snapshots)通过初始一致快照建立基线，再从快照对应的 Binlog 位点读取变更，生成插入、更新和删除事件。快照和位点由连接器协调，不能简单先扫完整张表、再开始监听后续变化，否则可能漏掉扫描期间的修改。

文档中的初始快照实现涉及锁、可重复读事务与位点记录，具体步骤受模式和环境影响；不能把这些步骤当成所有 CDC 产品的统一实现。连接器保存消费进度用于恢复；恢复可能重放事件。若需要的 Binlog 已被清理，则可能需要重新初始化，因此日志保留期也是恢复条件。

## 恢复与目标写入

[Flink 容错说明](https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/fault_tolerance/#exactly-once-end-to-end)指出，恢复会回退并重放源数据；状态的恰好一次保证不表示每个事件物理上只执行一次。要达到端到端恰好一次，源需要可重放，目标需要支持事务或幂等，并满足对应实现的提交与恢复条件。

目标为事务型数据库时，[Kafka Consumer Javadoc](https://kafka.apache.org/40/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)的 “Storing Offsets Outside Kafka” 给出一种具体做法：把消费结果和消费位置存入同一个关系型数据库，在同一事务内提交。这样二者一起成功，或一起不更新；禁用外部自动提交，重启后从数据库读取位置并定位恢复。用于 MySQL 时，业务表和进度表应处在同一个本地事务内，使用支持事务的存储引擎。进度按日志流或分区维护连续完成的位置；并行处理中间仍有未完成事件时，不能直接保存最大的已完成位置，否则会跳过空洞。

[Debezium 的故障恢复说明](https://debezium.io/documentation/reference/stable/connectors/mysql.html#mysql-when-things-go-wrong)解释另一种失败窗口：连接器已发送事件，但最新进度还没持久化，崩溃后会重新发送一部分事件。事件中的源信息可用于识别重复。因此，即使下游此前已写成功，恢复后仍可能再次收到同一次源变更。

据此，在外部系统保存消费进度时，可以设计「**去重记录与业务修改同事务，提交后再确认消费**」：

1. 消费程序拿到重放后保持不变的事件 ID，在目标 MySQL 开启事务。
2. 向 `processed_events` 插入事件 ID，该字段有唯一约束。插入成功才继续执行业务修改，两步一起提交。
3. 如果是该事件 ID 的重复键，回滚本次事务，跳过业务修改并确认该事件已处理；其他错误应回滚、重试或报错，不能一概跳过。
4. 事务提交成功后，再确认外部消费进度。提交前失败，去重记录和业务修改一起回滚；提交后、确认前失败，重放会命中去重记录。提交结果因断网而未知时，也可以重试同一个事件，由唯一约束区分前次是否提交。

这是基于数据库事务原子性的消费端设计，不是所有 CDC 工具默认提供的保证。MySQL 本地事务不能同时原子提交保存在 Kafka 中的消费位置；上述流程允许事件再次投递，通过去重让业务变更不重复生效。去重记录需覆盖可能重放的范围，相关表必须参与同一个目标库事务。

按行事件去重时，事件 ID 必须标识一次源变化，不能只用订单 ID，也不能只用事务 ID，因为一次事务可以修改多条记录。Debezium 的源元数据包含日志文件、位置、行信息等，构造去重身份时需要结合来源及事件拆分方式，不能声称单个 Binlog 位点天然唯一。Kafka 的主题、分区、偏移量能识别同一条 Kafka 记录的重复消费，但源端重放可能生成新的 Kafka 记录，因此只按下游偏移量去重不能覆盖这种源变更重复。

也可以把整个源事务作为去重单位。[MySQL 8.4 GTID 说明](https://dev.mysql.com/doc/refman/8.4/en/replication-gtids-concepts.html)指出，GTID 标识源库提交的事务，复制时保持不变。据此，源库开启 GTID、链路保留源事务边界、目标支持事务时，可以按完整源 GTID 建唯一约束，将该源事务对应的全部数据修改和 GTID 完成记录放在同一个目标事务中提交。重放时已完成的 GTID 跳过整个事务，新增、更新、删除都纳入同一判断；提交前失败则一起回滚。不能先提交数据、再单独标记 GTID，也不能只应用部分行变更就把整个 GTID 标为完成。

用于同步最新状态时，可以据此设计主键幂等覆盖，避免重试生成重复记录；如果执行金额累加等操作，则不能直接重复应用增量。这是应用层设计选择，不能只根据启用了 Checkpoint 就宣称整条链路正确。

幂等与顺序也需要分别处理：工程上可按同一业务主键保持事件顺序，或用可比较的业务版本、源顺序拒绝旧写入，避免旧事件覆盖新状态。保留历史变更时，则应按事件身份去重，而不是覆盖成最新状态。

## 落地示例与数据校验

[Flink Doris Connector](https://doris.apache.org/docs/3.x/ecosystem/flink-doris-connector/)提供 MySQL CDC 直接写 Doris 的示例，覆盖插入、更新和删除，因此 Kafka 并非每条同步链路的必经组件。目标能否删除、幂等覆盖或通过事务提交，受表模型、连接器模式与恢复配置影响；源结构变化也需要目标支持相应映射和演变。

[sync-diff-inspector 官方说明](https://docs.pingcap.com/tidb/stable/sync-diff-inspector-overview/)介绍分块比较数据、定位目标缺行、多行和字段不同的情况；示例中两端行数相同，仍检测出数据差异。工程上可先在两端分别计算块内行数与内容摘要，再对差异块比较具体记录。摘要要包含需要核对的字段内容，仅比较 ID 不能验证一般字段更新；计算摘要仍需读取受检数据，主要减少跨端传输和逐行比对成本。

校验需要可比的数据状态和计算口径。该工具要求比较范围不再变化；动态数据则需协调快照与同步进度，排除正常延迟。不能仅按创建时间筛出一批订单，就认为它们后续不会再更新或删除。数仓若做了转换、聚合，也应按相同口径核对结果。

工程修复可先按主键定向补写、修正或删除；大范围偏差再重建全量基线，用新快照对应的位点衔接增量，并处理源端已删除的残留数据。还应分别观察采集、处理与落地延迟、积压和失败，确认数据真正可查询，而不只看任务是否存活。
