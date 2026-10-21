let database: Promise<IDBDatabase> | undefined;

function lockDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('horizon-review-locks', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('locks');
    request.onerror = () => {
      database = undefined;
      reject(Error('无法锁定复习记录，请允许网站存储后重试。'));
    };
    request.onblocked = () => reject(Error('复习存储正在更新，请关闭其他视界标签页后重试。'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  });
  return database;
}

/** HTTP LAN pages lack Web Locks; an IDB readwrite transaction also serializes tabs. */
export async function withBrowserReviewLock<T>(key: string, task: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(key, task);
  const db = await lockDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('locks', 'readwrite');
    let result: T;
    let failure: unknown;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = transaction.onerror = () =>
      reject(failure ?? Error('无法锁定复习记录，请重试。'));
    // The synchronous read/check/write runs while the cross-tab transaction owns the lock.
    transaction.objectStore('locks').get(key).onsuccess = () => {
      try {
        result = task();
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
  });
}
