export interface IDbIndex {
  label: string;
  unique: boolean;
}

export default class IndexedDBService {
  dbName: string;
  dbVersion: number;
  dbIndex: IDbIndex[];
  db: IDBDatabase | null;
  constructor(dbName: string, dbVersion: number, dbIndex: IDbIndex[]) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this.dbIndex = dbIndex;
    this.db = null;
  }

  async openDatabase() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = (event) => {
        console.log("创建数据库失败");
        reject(event.target);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const objectStore = db.createObjectStore(this.dbName, {
          keyPath: "id",
          autoIncrement: true,
        });
        for (let i = 0; i < this.dbIndex.length; i++) {
          objectStore.createIndex(
            this.dbIndex[i].label,
            this.dbIndex[i].label,
            { unique: this.dbIndex[i].unique }
          ); //三个值分别是 索引名，索引所在属性，配置对象
        }
      };
    });
  }

  async addData<T>(data: T) {
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.dbName], "readwrite"); //写入数据 支持事务 transaction
      const objectStore = transaction.objectStore(this.dbName);
      const request = objectStore.add(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target);
      };
    });
  }

  async getAllData<T>() {
    return new Promise<T>((resolve, reject) => {
      const transaction = this.db!.transaction([this.dbName], "readonly");
      const objectStore = transaction.objectStore(this.dbName);
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T);
      };

      request.onerror = (event) => {
        reject(event.target);
      };
    });
  }

  async searchData<T>(key: string, value: string | number) {
    return new Promise<T>((resolve, reject) => {
      const transaction = this.db!.transaction([this.dbName], "readonly");
      const objectStore = transaction.objectStore(this.dbName);
      const indexName = objectStore.index(key);
      const request = indexName.getAll(value);

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T);
      };

      request.onerror = (event) => {
        reject(event.target);
      };
    });
  }

  async deleteData(id: number) {
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.dbName], "readwrite");
      const objectStore = transaction.objectStore(this.dbName);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target);
      };
    });
  }

  async deleteExpiredData() {
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.dbName], "readwrite");
      const objectStore = transaction.objectStore(this.dbName);
      const currentTime = Date.now();
      const expireTime = 7 * 24 * 60 * 60 * 1000; // 7 days
      const request = objectStore.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (currentTime - cursor.value.create_at > expireTime) {
            const deleteRequest = cursor.delete();
            deleteRequest.onsuccess = () => {
              cursor.continue();
            };
            deleteRequest.onerror = (event: any) => {
              reject(event.target.error);
            };
          } else {
            cursor.continue();
          }
        } else {
          resolve();
        }
      };
      request.onerror = (event) => {
        reject(event.target);
      };
    });
  }
}
/**
 * 使用示例
 * const indexedDBService = new IndexedDBService('MyDatabase', 1);
 * indexedDBService.openDatabase.then(()=>{
 *      indexedDBService.openDatabase().then().catch()
 *      indexedDBService.getAllData().then().catch()
 *      indexedDBService.searchData('name','张三').then().catch()
 *      indexedDBService.deleteData(id).then().catch()
 * }).catch(err=>{})
 */
