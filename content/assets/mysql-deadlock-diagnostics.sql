-- MySQL 8.4 / InnoDB 诊断查询；按需选择执行。
-- 按官方字段整理，未连接数据库执行验证。
-- 需要读取相关系统表的权限；不会启用采集、修改全局配置或终止连接。

-- 1. 保存最近一次死锁报告；核对报告时间。
SHOW ENGINE INNODB STATUS;

-- 2. 查看当前数据锁等待；空结果不代表没有发生过死锁。
SELECT wait_started, wait_age_secs,
       locked_table_schema, locked_table_name, locked_index,
       waiting_trx_id, waiting_pid, waiting_query,
       blocking_trx_id, blocking_pid, blocking_trx_started, blocking_query
FROM sys.innodb_lock_waits
ORDER BY wait_age_secs DESC;

-- 3. 分别关联请求锁和阻塞锁，核对对象、锁模式和记录值。
-- 锁 ID 是内部标识，按字段关联，不依赖其字符串格式。
SELECT w.REQUESTING_ENGINE_TRANSACTION_ID AS waiting_trx_id,
       w.REQUESTING_THREAD_ID AS waiting_ps_thread_id,
       w.BLOCKING_ENGINE_TRANSACTION_ID AS blocking_trx_id,
       w.BLOCKING_THREAD_ID AS blocking_ps_thread_id,
       r.OBJECT_SCHEMA, r.OBJECT_NAME, r.INDEX_NAME,
       r.LOCK_TYPE AS waiting_lock_type,
       r.LOCK_MODE AS waiting_lock_mode,
       r.LOCK_STATUS AS waiting_lock_status,
       r.LOCK_DATA AS waiting_lock_data,
       b.LOCK_TYPE AS blocking_lock_type,
       b.LOCK_MODE AS blocking_lock_mode,
       b.LOCK_STATUS AS blocking_lock_status,
       b.LOCK_DATA AS blocking_lock_data
FROM performance_schema.data_lock_waits AS w
JOIN performance_schema.data_locks AS r
  ON r.ENGINE = w.ENGINE
 AND r.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
JOIN performance_schema.data_locks AS b
  ON b.ENGINE = w.ENGINE
 AND b.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID;

-- 4. 检查当前事务；TRX_QUERY 为 NULL 仍可能是未结束的事务。
SELECT TRX_ID, TRX_STATE, TRX_STARTED, TRX_WAIT_STARTED,
       TRX_MYSQL_THREAD_ID, TRX_QUERY, TRX_ISOLATION_LEVEL,
       TRX_ROWS_LOCKED, TRX_ROWS_MODIFIED
FROM information_schema.INNODB_TRX
ORDER BY TRX_STARTED;

-- 5. 将 NULL 替换为报告中的 MySQL thread id / waiting_pid / blocking_pid。
-- 此处是连接 ID，不是 InnoDB 事务 ID 或 Performance Schema THREAD_ID。
SET @target_connection_id = NULL;
SELECT h.THREAD_ID, h.EVENT_ID, h.SQL_TEXT
FROM performance_schema.events_statements_history AS h
JOIN performance_schema.threads AS t ON t.THREAD_ID = h.THREAD_ID
WHERE t.PROCESSLIST_ID = @target_connection_id
ORDER BY h.EVENT_ID;
-- 历史必须已采集且尚未覆盖；连接退出后也可能已删除。
-- 返回的是连接的近期语句，需按应用时间线确认目标事务边界。

-- 6. 数据锁解释不适用于元数据锁；相关等待另查此视图。
SELECT object_schema, object_name,
       waiting_pid, waiting_query, waiting_lock_type,
       blocking_pid, blocking_lock_type
FROM sys.schema_table_lock_waits;

-- 7. 在可比窗口采样计数增量，不跨重启或计数重置直接相减。
SELECT NAME, COUNT, STATUS
FROM information_schema.INNODB_METRICS
WHERE NAME = 'lock_deadlocks';
