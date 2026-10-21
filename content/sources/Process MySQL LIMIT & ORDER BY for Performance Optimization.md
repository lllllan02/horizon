---
title: "Process MySQL LIMIT & ORDER BY for Performance Optimization"
source: "https://www.percona.com/blog/mysql-order-by-limit-performance-optimization/"
author:
  - "[[peter.zaitsev]]"
published: 2023-06-01
created: 2026-10-21
description: "MySQL ORDER BY LIMIT is often the cause of MySQL performance problems. Here is what you need to know to optimize the command and avoid issues."
tags:
  - "clippings"
---
[Download the New 2026 State of Open Source Database Management Report](https://www.percona.com/resource/state-of-open-source-db-management/)

[![](https://www.percona.com/wp-content/uploads/2026/02/Logo.svg)](https://www.percona.com/)

*Updated June 1, 2023.*

Suboptimal MySQL ORDER BY implementation, especially together with MySQL LIMIT is often the cause of MySQL performance problems. Here is what you need to know about MySQL ORDER BY LIMIT optimization to avoid these problems.

**Try Now:** [Free your applications with Percona Distribution for MySQL](https://www.percona.com/software/mysql-database)

## MySQL LIMIT clause

The MySQL LIMIT clause is a valuable tool for controlling the number of rows returned by a SELECT statement. By specifying the maximum number of rows to retrieve from the result set, it enables you to work with subsets of data, especially in situations involving large tables. This feature enhances query performance and optimizes resource usage by fetching only the necessary rows.

## Syntax of the MySQL LIMIT clause

The LIMIT clause in MySQL accepts one or two arguments: offset and count. Both parameters should be non-negative integers.

The offset parameter indicates the position of the first row to be returned from the result set, determining the number of rows to skip before returning the rows.

The count parameter specifies the maximum number of rows to be retrieved from the result set, setting a limit on the number of rows to be returned.

When using two parameters, the first parameter represents the offset, and the second parameter represents the count. This lets you retrieve a specific range of rows from the result set. But when using only one parameter, it signifies the number of rows to be returned from the beginning of the result set.

The basic syntax of the LIMIT clause is as below:

| 1  2  3 | SELECT column1, column2,...  FROM table\_name  LIMIT offset, count; |
| --- | --- |

## How to use the ORDER BY and LIMIT clauses in a query

MySQL **ORDER BY** with **LIMIT** is the most common use of ORDER BY in interactive applications with large data sets being sorted. On many websites, you will find top tags, recently registered users, etc., which often require ORDER BY with LIMIT in the back end. In general, this type of ORDER BY looks like SELECT ….. WHERE \[conditions\] ORDER BY \[sort\] LIMIT N, M.

**Make sure it uses index.** It is very important to have ORDER BY with LIMIT executed without scanning and sorting the full result set, so it is important for it to use index – in this case, index range scan will be started, and query execution stopped as soon as the required amount of rows generated.

## MySQL LIMIT clause examples

Below we take a look at several examples of how to use the MySQL LIMIT clause to retrieve specific results, including date created, category IDs, and running queries on multiple columns.

### Using MySQL LIMIT 10 to find result sets by ‘date\_created’ and ‘category\_id”

For example, if I do *SELECT \* FROM sites ORDER BY date\_created DESC LIMIT 10,* I would use index on (date\_created) to get a result set very fast.

Now what if I have something like *SELECT \* FROM sites WHERE category\_id=5 ORDER BY date\_created DESC LIMIT 10;*

In this case index by date\_created may also work but it might not be the most efficient – If it is a rare category large portion of table may be scanned to find 10 rows. So index on (category\_id, date\_created) will be a better idea.

Let’s take a look at a bit more complex case: *SELECT \* FROM sites WHERE category\_id in (5,10,12) ORDER BY date\_created DESC LIMIT 10;*

Even though it looks quite similar to the previous one, it is a lot different as there are multiple category\_id values in the list now, so index on (category\_id, date\_created) can’t be used directly. Index on date\_created separately would still work. The good from a performance standpoint (even though a bit ugly) will be [UNION workaround](https://www.percona.com/blog/mysql-followup-on-union-for-query-optimization-query-profiling/) I already wrote about.

### Using MySQL LIMIT for queries on multiple columns

So what if you have an application which can perform a search on many different columns with worse-than-perfect selectivity? Various social networking and dating sites are perfect examples of such queries.

*SELECT FROM people where gender=’m’ and age between 18 and 28 and country\_id=5 and city\_id=345 order by last\_online desc limit 10;*

There could be many possible limiting factors, with all of them being optional. This is a hard nut to crack, and I know on high-end custom search solutions can be developed, but if we stick to simple [MySQL](https://www.percona.com/software/mysql-database/percona-server), using multiple indexes on most selective columns would be a good idea for the performance of such queries.

For example, you may put index on(gender,last\_online), assuming most people will have gender specified, as well as (country\_id,city\_id,last\_online), assuming in most cases these will be specified. It takes a good look at queries actually being run and data selectivity to come up with a good set of indexes for such cases, it also may need to be adjusted in the future.

The main thing to watch for if you do not have a full WHERE clause resolved by index is how many rows you need to scan to resolve order by (this can be found in a slow query log or by examining Hander statistics). If only 50 rows are examined to provide 10 rows of a result set, you’re in decent shape. But if it is 5,000, you might need to rethink your indexing.

Also, note – the number of records scanned to provide a result set will be very dynamic based on particular constant and other factors.

For example, for our dating example, if we use only (last\_online) index and look for people from the USA, we likely will find ten people pretty quickly if the country is small or simply there are few members from the country, i.e., Slovenia – the same kind of search might need to scan 1,000s of times more rows to provide a result set.

In the example above, we did order by last column. In fact, the index can be used for ORDER BY if sorting is done by leading column(s). Note, however, columns following column used for order by can’t be used to restrict the result set. For example:

key(a,b,c) *SELECT \* FROM tbl WHERE c=5 ORDER BY a,b limit 10* – In this case, first two columns from the index can be used to satisfy order by, index, however, will not be helpful to check c=5 (unless it is index covered query). Index on (c,a,b) would work better for the query above.

**Related Content:** Need a drop-in replacement for any MySQL database? Check out [Percona Server for MySQL](https://www.percona.com/software/mysql-database/percona-server)

## Best practices for using the MySQL limit clause

### Do not sort by expressions

I guess this one is obvious – expressions or functions will block index usage for order by.

### Sort by column in leading table

If you have JOIN with ORDER BY … LIMIT you should try hard to have sorting column(s) to be in the leading table. If ORDER BY is going by field from the table, which is not first in the join order index can’t be used. Sometimes it means breaking normalization and duplicating column(s) you’re going to use in ORDER BY in other tables.

Here is an example when ORDER BY is done by the second table, which requires filesort:

| 1  2  3  4  5  6  7  8 | mysql> explain select test.i from test, test t where test.k=5 and test.i=t.k order by t.k limit 5;  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  \| id \| select\_type \| table \| type \| possible\_keys \| key \| key\_len \| ref \| rows \| Extra \|  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  \| 1 \| SIMPLE \| test \| ref \| PRIMARY,k \| k \| 4 \| const \| 1 \| Using temporary; Using filesort \|  \| 1 \| SIMPLE \| t \| ref \| k \| k \| 4 \| test.test.i \| 1 \| Using where; Using index \|  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  2 rows in set (0.00 sec) |
| --- | --- |

However, if the first table has “const” or “system” access type it is effectively removed from join execution (replaced with constants) and so ORDER BY can be optimized even if it is done by the second table:

| 1  2  3  4  5  6  7  8 | mysql> explain select test.i from test, test t where test.i=5 and test.k=t.k order by t.k limit 5;  +----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+  \| id \| select\_type \| table \| type \| possible\_keys \| key \| key\_len \| ref \| rows \| Extra \|  +----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+  \| 1 \| SIMPLE \| test \| const \| PRIMARY,k \| PRIMARY \| 4 \| const \| 1 \| \|  \| 1 \| SIMPLE \| t \| ref \| k \| k \| 4 \| const \| 1 \| Using index \|  +----+-------------+-------+-------+---------------+---------+---------+-------+------+-------------+  2 rows in set (0.01 sec) |
| --- | --- |

The difference between these cases is “i” is the primary key while “k” is simply an indexed column.

**Note:** In some cases, even if it is possible to use index to do ORDER BY with JOIN, MySQL still will not be able to use it as Optimizer is not smart enough yet to detect such cases:

| 1  2  3  4  5  6  7  8 | mysql> explain select test.i from test, test t where test.k=5 and test.i=t.k order by test.k,t.j limit 5;  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  \| id \| select\_type \| table \| type \| possible\_keys \| key \| key\_len \| ref \| rows \| Extra \|  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  \| 1 \| SIMPLE \| test \| ref \| PRIMARY,k \| k \| 4 \| const \| 1 \| Using temporary; Using filesort \|  \| 1 \| SIMPLE \| t \| ref \| k \| k \| 4 \| test.test.i \| 1 \| Using where; Using index \|  +----+-------------+-------+------+---------------+------+---------+-------------+------+---------------------------------+  2 rows in set (0.00 sec) |
| --- | --- |

In this case, there is index (k,j) on the table, so indexes could be used on each of the tables to optimize order by, or at least local sort could be used for each t.k=const value for the second table. Which is not done, however.

### Sort in one direction

If you have ORDER BY col1, col2, it can be optimized using index. If you have ORDER BY col1 DESC, col2 DESC same thing, however, if you would have ORDER BY col1, col2 DESC MySQL will have to use filesort. A classic solution for this would be to have index which is sorted appropriately (ascending by col1 and descending by col2), but MySQL can’t do it at this point. Workaround which can be currently used is separate column which holds reverse values so that you can do ORDER BY col1, col2\_reverse instead.

### Beware of large LIMIT

Using index to sort is efficient if you need first few rows, even if some extra filtering takes place, so you need to scan more rows by index than requested by LIMIT. However, if you’re dealing with LIMIT query with large offset, efficiency will suffer. LIMIT 1000,10 is likely to be way slower than LIMIT 0,10. It is true most users will not go further than 10 pages in results. However, Search Engine Bots may very well do so. I’ve seen bots looking at 200+ pages in my projects. Also, many websites fail to take care of this, providing a very easy task to launch a DOS attack – a request page with a large number from few connections, and it is enough. If you do not do anything else, make sure you block requests with too large page numbers.

For some cases, for example, if results are static, it may make sense to precompute results so you can query them for positions. So instead of query with LIMIT 1000,10 you will have WHERE position between 1000 and 1009, which has the same efficiency for any position (as long as it is indexed)

### Force index if needed

In some cases, MySQL Optimizer may prefer to use a different index, which has better selectivity or just better estimates, instead of which allows you to do the sort. For example, if you would have indexes on (country\_id,city\_id) and index on (country\_id,last\_online) for query *SELECT \* FROM people WHERE country\_id=5 and city\_id=6 order by last\_online desc limit 10,* the first index will likely be selected even if it leads to filesort.

The solution for this problem is either extending your indexes so MySQL Optimizer does not have to choose between better sort or better lookup or using FORCE INDEX to force it to use the appropriate index.

Many of the tips I’ve mentioned here work for MySQL ORDER BY without LIMIT as well, but there are some differences. I should write another article about ORDER BY without limit and large tables soon.

For queries like “ **SELECT … WHERE \[conditions\] ORDER BY \[sort\] LIMIT N** “, the optimizer may choose the index to resolve ORDER BY instead of using an index on the column(s) in WHERE clause. There was a bug that was fixed in MySQL 5.7.

Bug: [https://bugs.mysql.com/bug.php?id=73837](https://bugs.mysql.com/bug.php?id=73837)

From: [https://dev.mysql.com/doc/relnotes/mysql/5.7/en/news-5-7-6.html](https://dev.mysql.com/doc/relnotes/mysql/5.7/en/news-5-7-6.html)

> For queries that combine `ORDER BY` with `LIMIT`, the optimizer may switch to an index that applies to the `ORDER BY`. In some cases, the decision to switch was based on a heuristic rather than on cost. The optimizer now uniformly makes the decision whether to switch on a cost basis. This should result in better performance when switching would cause a query to read an entire index or a large part of it to find qualifying rows.  
> References: See also: Bug #78993, Bug #22108385, Bug #73837, Bug #19579507, Bug #16522053.

## Using descending index

MySQL 8.0 introduced descending indexes which store the key values of an index in descending order. A descending index can be scanned in forward order, which is more efficient. If a query mixes ASC and DESC, the optimizer can use an index on the columns if the index also uses corresponding mixed ascending and descending columns:

> SELECT \* FROM test  
> ORDER BY k DESC, j ASC;

The optimizer can use an index on (k, j) if k is descending and j is ascending. It can also use an index on those columns (with a backward scan) if k is ascending and j is descending.

If multiple rows have the same value in the ORDER BY columns, the server is free to return those rows in any order. If it is important to ensure the same row order with and without LIMIT, include additional columns in the ORDER BY clause to make the order deterministic.

## Choosing a MySQL Support Solution

Percona Support for MySQL is a valuable solution for organizations seeking to enhance their existing MySQL talent with the support and expertise provided by Percona’s open source software, services, and industry-best SLAs.

Organizations can enjoy a wide range of benefits, including comprehensive and responsive support for MySQL databases across various infrastructures, whether it’s on-premises, in the cloud, or in a database-as-a-service (DBaaS) environment. With Percona, organizations can have peace of mind knowing they have access to reliable and cost-flexible support for their MySQL databases, allowing them to focus on their core business operations.

## Some free resources that you might find useful

### Webinars

- - [Reducing MySQL Costs in the Cloud](https://www.percona.com/resources/webinars/top-most-overlooked-mysql-performance-optimizations)
- - [How to Ease Major MySQL Upgrades](https://learn.percona.com/how-to-ease-major-mysql-upgrades?_gl=1*w6nacf*_gcl_au*NDAwNTk4MTA0LjE2ODUxNDEzOTM.)
- - [Ask me anything about MySQL 5.7 to 8 Migration](https://learn.percona.com/ask-me-anything-about-mysql-5.7-to-8-migration?_gl=1*w6nacf*_gcl_au*NDAwNTk4MTA0LjE2ODUxNDEzOTM.)

### Blog Posts

- - [Best practices for configuring optimal MySQL memory usage](https://www.percona.com/blog/best-practices-for-configuring-optimal-mysql-memory-usage/)
- - [MySQL query performance – not just indexes](https://www.percona.com/blog/is-indexing-always-the-key-to-mysql-query-performance/)
- - [Understanding MySQL Query Digest with Performance Schema](https://www.percona.com/blog/mysql-query-digest-with-performance-schema/)
- - [Scaling MySQL – A good problem to have](https://www.percona.com/blog/scaling-mysql-a-good-problem-to-have/)

### White Papers & eBooks

- - [6 Common Causes of Poor Database Performance](https://www.percona.com/resources/ebooks/six-common-causes-poor-database-performance)
- - [How to Manage Complex Database Environments Effectively](https://www.percona.com/resources/ebooks/how-manage-complex-database-environments-effectively)

## FAQS

### Does MySQL have a limit?

Yes, MySQL does impose a limit on the number of rows that can be returned using the LIMIT clause. The specific limit varies depending on the version of MySQL being used and the configuration settings.

In earlier versions of MySQL, such as versions prior to 8.0.17, the maximum number of rows that can be returned is 18446744073709551615 (2^64 – 1). This value is extremely large and is considered practically unlimited for most practical use cases.

However, starting from MySQL version 8.0.17, the maximum number of rows that can be returned is determined by the value of the max\_allowed\_packet variable. By default, this value is set to 4MB. If there is a need to retrieve a larger number of rows, this value can be increased accordingly to accommodate larger result sets.

### What is the maximum MySQL database size?

In MySQL, the maximum size of a database is not directly imposed by MySQL itself. Instead, it is determined by the file system limits of the operating system on which the database is hosted. MySQL leverages the file system to store the database files, and the maximum size is subject to the constraints and limitations set by the underlying file system.

### What is the limit option in MySQL?

In MySQL, the LIMIT option serves the purpose of limiting the number of rows that are returned by a SELECT statement. It provides a way to specify the maximum number of rows that you want to retrieve from the result set. By using the LIMIT clause, you can control the amount of data that is returned, making it particularly useful when dealing with large tables or when you only need to retrieve a subset of the data.

### What is the limit of MySQL user?

In MySQL, there is no predefined limit on the number of users that can be created. The ability to create users depends on the system resources and configuration of the MySQL server. Factors such as available memory, disk space, and the maximum number of open file descriptors allowed by the operating system can impact the number of users that can be effectively managed.

To ensure efficient management of user accounts, it is advisable to create user accounts as needed and revoke unnecessary privileges when they are no longer required.

### What does limit 100 mean in SQL?

In SQL, the LIMIT clause is used to restrict the number of rows returned by a SELECT statement. When LIMIT is used with a numeric value, such as LIMIT 100, it specifies that the query should return a maximum of 100 rows from the result set.

### Does MySQL sort by primary key?

By default, in MySQL, when you execute a SELECT statement without specifying an explicit ordering using the ORDER BY clause, the result set is not guaranteed to be sorted by the primary key or any other specific column. If you want to ensure a specific order of the result set, you should use the ORDER BY clause and specify the column(s) by which you want the data to be sorted.

MySQL, PostgreSQL, InnoDB, MariaDB, MongoDB and Kubernetes are trademarks for their respective owners.