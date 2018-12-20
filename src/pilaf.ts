import produce from 'immer';
import {ArrayedObject} from './utils';

/**
 * @alias
 */
type A<T extends {[x: string]: any}> = ArrayedObject<T>;

enum ResolverResultType {
  One,
  Many,
}

const resolverResultMap: WeakMap<
  object,
  {
    name: string;
    propName?: string;
  }
> = new WeakMap();

interface ResolverResult<T extends {[x: string]: any}> {
  type: ResolverResultType;
  propName: string;
  from: keyof T;
  base: string;
  paths: [string, string];
}

interface ResolverHandlerFunction<
  T extends {[x: string]: any},
  P extends keyof T
> {
  (base: string, name: P): ResolverResult<T>;
  (base: string): ResolverResult<T>;
}

interface ResolverHandler<T extends {[x: string]: any}, P extends keyof T> {
  (name: keyof T[P], propName: string): ResolverHandler<T, P>;
  (name: keyof T[P]): ResolverHandler<T, P>;
  one: ResolverHandlerFunction<T, P>;
  many: ResolverHandlerFunction<T, P>;
}

type ResolverHandlers<T extends {[x: string]: any}> = {
  [P in keyof T]: ResolverHandler<T, P>
};

interface ResolverFunction<T extends {[x: string]: any}> {
  (handlers: ResolverHandlers<T>): ResolverResult<T>[];
}

type Resolvers<T extends object> = Record<keyof T, ResolverFunction<T>>;

interface StoreHandlerFunctions<T extends {[x: string]: any}> {
  add(item: T): void;
  updateBy<P extends keyof T>(
    itemProp: P,
    value: T[P],
    newValue: Partial<T>,
  ): void;
  removeBy<P extends keyof T>(itemProp: P, value: T[P]): void;
}

type StoreHandlers<T extends {[x: string]: any}> = {
  [P in keyof T]: StoreHandlerFunctions<T[P]>
};

interface StoreHandlersFunction<T extends {[x: string]: any}> {
  (handlers: StoreHandlers<T>): void;
}

interface Store<T extends {[x: string]: any}> {
  this: StoreHandlers<T> & {tables: any};
  (cb: StoreHandlersFunction<T>): Store<T> & A<T>;
}

export class Pilaf<
  IS extends object,
  OS extends Record<keyof IS, any>,
  R extends Resolvers<IS> = Resolvers<IS>
> {
  tables: A<IS>;

  static createTables<U>(keys: string[]) {
    return keys.reduce(
      (result, key) => {
        result[key] = [];
        return result;
      },
      {} as Partial<U> & {[x: string]: any},
    );
  }

  constructor(public readonly resolvers: R) {
    this.tables = Pilaf.createTables<A<IS>>(Object.keys(resolvers));
  }

  add<P extends keyof IS>(name: P, item: IS[P]): this {
    this.tables = produce<A<IS>>(draft => {
      ((draft as any)[name] as IS[P][]).push(item);
    })(this.tables);

    return this;
  }

  removeBy = <P extends keyof IS>(name: P) => ({
    /**
     * Proxy化したい
     */
    id: (id: number): boolean => {
      let removed = false;
      this.tables = produce<A<IS>>(draft => {
        (draft as any)[name] = ((draft as any)[name] as IS[P][]).filter(
          (item: any) => {
            const result = item.id === id;
            if (result) {
              removed = true;
            }
            return !result;
          },
        );
      })(this.tables);

      return removed;
    },
  });

  createTableHandler = <P extends keyof IS>(tableName: P) => (
    draft: A<IS>,
  ): StoreHandlerFunctions<IS[P]> => {
    return {
      add: item => {
        draft[tableName].push(item);
      },
      updateBy: (itemProp, value, newValue) => {
        draft[tableName].forEach(item => {
          if (item[itemProp] === value) {
            Object.assign(item[itemProp], newValue);
          }
        });
      },
      removeBy: (itemProp, value) => {
        draft[tableName] = draft[tableName].filter(
          item => item[itemProp] !== value,
        );
      },
    };
  };

  create<RE extends Store<IS> & A<IS> = Store<IS> & A<IS>>(tables?: A<IS>): RE {
    const self = this;
    const selectFn = this.select;
    const createFn = this.create;
    const tableNames = Object.keys(this.tables) as (keyof IS)[];
    const createTableHandler = this.createTableHandler;
    const object: {
      resolvers: R;
      tables: A<IS>;
    } = {
      resolvers: this.resolvers,
      tables: tables || Pilaf.createTables(tableNames as string[]),
    };

    const store: any = function(
      this: StoreHandlers<IS> & {tables: A<IS>},
      cb: (handlers: StoreHandlers<IS>) => void,
    ) {
      const tables = produce<A<IS>>(draft => {
        const storeHandlers = tableNames.reduce(
          (result, tableName) => {
            result[tableName] = createTableHandler(tableName)(draft as any);
            return result;
          },
          {} as StoreHandlers<IS>,
        );

        cb(storeHandlers);
      })(object.tables);

      if (tables === this.tables) {
        return store as RE;
      }
      return createFn.call(self, tables);
    }.bind(object as StoreHandlers<IS> & {
      resolvers: R;
      tables: A<IS>;
    });

    tableNames.forEach(tableName => {
      const getter = function(this: {resolvers: R; tables: A<IS>}) {
        return selectFn.call(this, tableName);
      };
      Object.defineProperty(store, tableName, {
        get: getter.bind(object),
      });
    });

    return store as RE;
  }

  /**
   * 関係を構築して返す
   * @param tableName 取得したいテーブル名
   * @param clear テーブルを初期状態に戻すかどうか
   * @returns 関係構築済みのオブジェクト
   */
  private select<P extends keyof IS = keyof IS, R extends OS[P][] = OS[P][]>(
    tableName: P,
    // clear: boolean = true,
  ): OS[P][] {
    const cb = this.resolvers[tableName];
    const keys = Object.keys(this.tables) as P[];

    const tableHandlers = keys.reduce(
      (result, key) => {
        const handle: any = function(this: any, name: P, propName?: string) {
          resolverResultMap.set(this, {
            name: name as string,
            propName,
          });
          return this as Function;
        };
        handle.one = function(base: string, name?: P) {
          return {
            type: ResolverResultType.One,
            propName: resolverResultMap.has(this)
              ? resolverResultMap.get(this)!.propName || key
              : key,
            from: tableName,
            base,
            paths: [
              key,
              (resolverResultMap.has(this)
                ? resolverResultMap.get(this)!.name
                : name) as string,
            ] as any,
          };
        };
        handle.many = function(base: string, name?: P) {
          return {
            type: ResolverResultType.Many,
            propName: resolverResultMap.has(this)
              ? resolverResultMap.get(this)!.propName
              : key,
            from: tableName,
            base,
            paths: [
              key,
              (resolverResultMap.has(this)
                ? resolverResultMap.get(this)!.name || key
                : name) as string,
            ] as [string, string],
          };
        };

        result[key] = handle.bind(handle);

        return result;
      },
      {} as ResolverHandlers<IS> &
        ((
          this: ResolverHandler<IS, P>,
          name: keyof IS[P],
        ) => ResolverHandler<IS, P>),
    );

    const resolvers = cb(tableHandlers);
    if (resolvers === undefined) {
      throw new Error('todo');
    }

    const items = [...this.tables[tableName]];

    const result = items.map((item: {[x: string]: any}) => {
      const itemKeys = Object.keys(item);
      return itemKeys.reduce(
        (result, key) => {
          const targetProp = resolvers.find(resolver => resolver.base === key);
          if (targetProp === undefined) {
            result[key] = item[key];
            return result;
          }

          // 元も取っておく
          result[key] = item[key];

          switch (targetProp.type) {
            case ResolverResultType.One: {
              result[targetProp.propName] = targetProp.paths.reduce(
                (result, path, i) => {
                  if (i === 0) {
                    return result[path];
                  }

                  const otherTableItems = result;
                  return otherTableItems.find(
                    (otherTableItem: {[x: string]: any}) => {
                      return otherTableItem[path] === item[targetProp.base];
                    },
                  );
                },
                this.tables as any,
              );
              return result;
            }
            case ResolverResultType.Many: {
              result[targetProp.propName] = targetProp.paths.reduce(
                (result, path, i) => {
                  if (i === 0) {
                    return result[path];
                  }

                  const otherTableItems = result;
                  return otherTableItems.filter(
                    (otherTableItem: {[x: string]: any}) => {
                      return otherTableItem[path] === item[targetProp.base];
                    },
                  );
                },
                this.tables as any,
              );
              return result;
            }
            default: {
              throw new TypeError(`got a strange type ${targetProp.type}`);
            }
          }
        },
        {} as any,
      );
    }) as R;

    return result;
  }

  // clear() {
  //   this.tables = Pilaf.createTables<A<IS>>(Object.keys(this.tables));
  // }
}
