import produce from 'immer';

/**
 * Change object values `T[P]` into array `T[P][]`
 */
export type ArrayedObject<T extends {[x: string]: any}> = {
  [P in keyof T]: T[P][]
};

/**
 * @alias ArrayedObject
 */
type A<T extends {[x: string]: any}> = ArrayedObject<T>;

/**
 * Type of how to resolves data
 */
enum ResolverResultType {
  One,
  Many,
}

/**
 * Data map in which to use during resolving
 */
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

interface StoreHandlerUpdateByFunctionWhere<
  T extends {[x: string]: any},
  DP extends keyof T
> {
  <P extends keyof T>(itemProp: P, value: NonNullable<T[P]>): boolean;
  (value: NonNullable<T[DP]>): boolean;
  in<P extends keyof T>(itemProp: P, value: NonNullable<T[P]>[]): boolean;
  in(value: NonNullable<T[DP]>[]): boolean;
}

interface StoreHandlerUpdateByFunction<T extends {[x: string]: any}> {
  <P extends keyof T = keyof T>(
    itemProp: P,
    newValue: T[P],
  ): StoreHandlerUpdateByFunctionWhere<T, P>;
}

interface StoreHandlerDeleteByFunctionWhere<V> {
  (value: NonNullable<V>): boolean;
  in(value: NonNullable<V>[]): boolean;
}

interface StoreHandlerDeleteByFunction<T extends {[x: string]: any}> {
  <P extends keyof T = keyof T>(itemProp: P): StoreHandlerDeleteByFunctionWhere<
    T[P]
  >;
}

interface StoreHandlerFunctions<T extends {[x: string]: any}> {
  add(item: T | T[]): void;
  updateBy: StoreHandlerUpdateByFunction<T>;
  deleteBy: StoreHandlerDeleteByFunction<T>;
  clear(): void;
}

type StoreHandlers<T extends {[x: string]: any}> = {
  [P in keyof T]: StoreHandlerFunctions<T[P]>
};

interface StoreController<T extends {[x: string]: any}, PL> {
  clear(): StoreFn<T, PL> & A<T> & StoreController<T, PL>;
}

interface StoreHandlersFunction<T extends {[x: string]: any}> {
  (handlers: StoreHandlers<T>): void;
}

export type StorePrototypeLikeThis<T extends {[x: string]: any}, PL> = ((
  cb: (handlers: StoreHandlers<T>) => void,
) => Store<T, PL>);

export type Store<T extends {[x: string]: any}, PL> = StoreFn<T, PL> &
  A<T> &
  StoreController<T, PL> &
  PL;

/**
 * Immutable store
 */
export interface StoreFn<T extends {[x: string]: any}, PL> {
  this: StoreHandlers<T> & {tables: any};
  (cb?: StoreHandlersFunction<T>): Store<T, PL>;
}

/**
 * A store
 */
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

  private createTableHandler = <P extends keyof IS>(tableName: P) => (
    draft: A<IS>,
  ): StoreHandlerFunctions<IS[P]> => {
    const updateBy: any = function<IP extends keyof IS[P]>(
      itemProp: IP,
      newValue: IS[P][IP],
    ) {
      const where = function(value: IS[P][IP]) {
        let removed = false;
        draft[tableName].forEach(item => {
          const result = item[itemProp] === value;
          if (result) {
            if (!removed) {
              removed = true;
            }
            item[itemProp] = newValue;
          }
        });

        return removed;
      };

      where.in = (values: IS[P][IP][]) => {
        return values.map(value => where(value)).some(Boolean);
      };

      return where;
    };

    const deleteBy: any = function<IP extends keyof IS[P]>(itemProp: IP) {
      const where = function(value: IS[P][IP]) {
        let removed = false;
        draft[tableName] = draft[tableName].filter(item => {
          const result = item[itemProp] === value;
          if (result) {
            removed = true;
          }

          // 引っかからないのを残したいので反転
          return !result;
        });

        return removed;
      };

      where.in = (values: IS[P][IP][]) => {
        return values.map(value => where(value)).some(Boolean);
      };

      return where;
    };
    return {
      add: item => {
        if (Array.isArray(item)) {
          draft[tableName].push(...item);
          return;
        }
        draft[tableName].push(item);
      },
      updateBy: updateBy as StoreHandlerUpdateByFunction<IS[P]>,
      deleteBy: deleteBy as StoreHandlerDeleteByFunction<IS[P]>,
      clear: () => {
        draft[tableName] = [];
      },
    };
  };

  create<PL extends unknown = unknown>(
    prototypeLike?: PL,
    tables?: A<IS>,
  ): Store<IS, PL> {
    const self = this;
    const selectFn = this.select;
    const createFn = this.create;
    const prototypeLikeObj = prototypeLike || ({} as {});
    const prototypeNames = Object.keys(prototypeLikeObj);
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
      this: StoreHandlers<IS> & {resolvers: R; tables: A<IS>},
      cb?: (handlers: StoreHandlers<IS>) => void,
    ) {
      if (cb === undefined) {
        return store;
      }

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
        return store as Store<IS, PL>;
      }
      return createFn.call(self, prototypeLikeObj, tables);
    }.bind(object as StoreHandlers<IS> & {
      resolvers: R;
      tables: A<IS>;
    } & StoreController<IS, PL>);

    prototypeNames.forEach(prototypeKey => {
      if (
        typeof (prototypeLikeObj as {[x: string]: any})[prototypeKey] ===
        'function'
      ) {
        Object.defineProperty(store, prototypeKey, {
          value: (prototypeLikeObj as {[x: string]: any})[prototypeKey].bind(
            store,
          ),
        });
      } else {
        Object.defineProperty(store, prototypeKey, {
          enumerable: true,
          value: (prototypeLikeObj as {[x: string]: any})[prototypeKey],
        });
      }
    });

    tableNames.forEach(tableName => {
      const getter = function(this: {resolvers: R; tables: A<IS>}) {
        return selectFn.call(this, tableName);
      };
      Object.defineProperty(store, tableName, {
        get: getter.bind(object),
      });
    });

    store.clear = () => {
      return createFn.call(
        self,
        prototypeLikeObj,
        Pilaf.createTables<IS>(tableNames as string[]),
      );
    };

    return store as Store<IS, PL>;
  }

  /**
   * 関係を構築して返す
   * @param tableName 取得したいテーブル名
   * @param clear テーブルを初期状態に戻すかどうか
   * @returns 関係構築済みのオブジェクト
   */
  private select<P extends keyof IS = keyof IS, R extends OS[P][] = OS[P][]>(
    tableName: P,
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

  clear() {
    this.tables = Pilaf.createTables<A<IS>>(Object.keys(this.tables));
  }
}