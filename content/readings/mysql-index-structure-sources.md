---
title: "MySQL 索引结构官方资料导读"
category: "MySQL"
tags: ["MySQL", "B+树", "索引结构"]
type: article
learning_status: pending
created_at: "2026-10-20 21:06:38"
updated_at: "2026-10-20 21:06:38"
source:
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html"
  - "https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool.html"
---

MySQL 8.4 官方手册用 B-tree 统称 InnoDB 的常规树索引，并说明索引记录存放在叶页；结合[[opendsa-b-trees|B+ 树教材]]中「内部节点导航、叶节点保存数据条目」的定义，可以理解面试中常说的 B+ 树结构。本篇节选索引组织、叶节点内容与缓存边界，未运行数据库实验。

## InnoDB 的常规索引

[索引物理结构](https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html)说明，索引记录存储在树的叶页中，索引页默认大小为 16 KB，由实例初始化时的 `innodb_page_size` 决定。普通主键和二级索引可按 B+ 树理解；同章明确空间索引采用 R-tree，不能把所有索引类型一概归为 B+ 树。

OpenDSA 教材解释了这种结构的收益：内部节点仅负责导航，较高的分支数使树较浅；定位范围起点后，可以沿叶节点链继续扫描。具体容量取决于页大小与条目大小，不能据此承诺固定树高或查询耗时。

## 叶节点保存什么

[聚簇索引与二级索引](https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html)说明，每张 InnoDB 表有一个保存行数据的聚簇索引；显式定义主键时，主键就是聚簇索引。没有主键时，依次选择第一个所有列均非空的唯一索引，或生成基于隐藏行 ID 的聚簇索引。

「**二级索引记录包含索引列和对应行的主键列**」。通过二级索引取得主键后，可继续在聚簇索引中定位行；如果索引已包含查询需要的字段，可利用[[mysql-slow-query-sources#索引要匹配查询与成本|覆盖索引]]减少额外取行。主键越长，二级索引占用的空间也会增加，因此不能把所有叶节点都描述为保存完整行。

## 树高与磁盘读取的边界

[缓冲池](https://dev.mysql.com/doc/refman/8.4/en/innodb-buffer-pool.html)缓存已访问的表和索引数据，热点页可以直接从内存读取。因此，「**树高描述查找路径的层数，不等于实际磁盘 I/O 次数**」；范围扫描涉及多少叶页、是否回表以及缓存命中情况，都影响实际访问成本。
