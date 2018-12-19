import produce from 'immer';

type ArrayedObject<T extends object> = {[P in keyof T]: T[P][]};
/**
 * @alias
 */
type A<T extends object> = ArrayedObject<T> & {[x: string]: object[]};

enum ResolverResultType {
  OneToOne,
  ManyToOne,
  OneToMany,
  ManyToMany,
}

const resolverResultMap: WeakMap<
  object,
  {
    name: string;
    propName?: string;
  }
> = new WeakMap();

interface ResolverResult<T extends object> {
  type: ResolverResultType;
  propName: string;
  from: keyof T;
  base: string;
  paths: [string, string];
}

interface ResolverHandlerFunction<T extends object, P extends keyof T> {
  (base: string, name: P): ResolverResult<T>;
  (base: string): ResolverResult<T>;
}

interface ResolverHandler<T extends object, P extends keyof T> {
  (name: keyof T[P], propName: string): ResolverHandler<T, P>;
  (name: keyof T[P]): ResolverHandler<T, P>;
  oneToOne: ResolverHandlerFunction<T, P>;
  oneToMany: ResolverHandlerFunction<T, P>;
  manyToOne: ResolverHandlerFunction<T, P>;
  manyToMany: ResolverHandlerFunction<T, P>;
}

type ResolverHandlers<T extends object> = {
  [P in keyof T]: ResolverHandler<T, P>
};

interface ResolverFunction<T extends object> {
  (handlers: ResolverHandlers<T>): ResolverResult<T>[];
}

type Resolvers<T extends object> = Record<keyof T, ResolverFunction<T>>;

export class Pilaf<T extends object, R extends Resolvers<T> = Resolvers<T>> {
  tables: A<T>;

  static initTables<U>(keys: string[]) {
    return produce<U>(draft => {
      keys.forEach(key => {
        (draft as any)[key] = [];
      });
    })({} as any);
  }

  constructor(public readonly resolvers: R) {
    this.tables = Pilaf.initTables<A<T>>(Object.keys(resolvers));
  }

  add(name: keyof T, item: T[keyof T]): this {
    this.tables = produce<A<T>>(draft => {
      ((draft as any)[name] as T[keyof T][]).push(item);
    })(this.tables);

    return this;
  }

  removeBy = (name: keyof T) => ({
    /**
     * Proxy化したい
     */
    id: (id: number): boolean => {
      let removed = false;
      this.tables = produce<A<T>>(draft => {
        (draft as any)[name] = ((draft as any)[name] as T[keyof T][]).filter(
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

  /**
   * 関係を構築して返す
   * @param tableName 取得したいテーブル名
   * @param clear テーブルを初期状態に戻すかどうか
   * @returns 関係構築済みのオブジェクト
   */
  // @ts-ignore
  select<U extends object, P extends keyof T = keyof T>(
    tableName: P,
    clear: boolean = true,
  ): U {
    const cb = this.resolvers[tableName];

    const keys = Object.keys(this.tables) as (keyof T)[];
    const tableHandlers = keys.reduce(
      (result, key) => {
        const handle: any = function(this: any, name: P, propName?: string) {
          resolverResultMap.set(this, {
            name: name as string,
            propName,
          });
          return this as Function;
        };
        handle.oneToOne = (base: string, name?: P) => {
          return {
            type: ResolverResultType.OneToOne,
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
        handle.oneToMany = function(base: string, name?: P) {
          return {
            type: ResolverResultType.OneToMany,
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
            ] as [string, string],
          };
        };
        handle.manyToOne = function(base: string, name?: keyof T) {
          return {
            type: ResolverResultType.ManyToOne,
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
        handle.manyToMany = function(base: string, name?: keyof T) {
          return {
            type: ResolverResultType.ManyToMany,
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
      {} as ResolverHandlers<T> &
        ((
          this: ResolverHandler<T, P>,
          name: keyof T[P],
        ) => ResolverHandler<T, P>),
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

          switch (targetProp.type) {
            case ResolverResultType.OneToOne: {
              throw new Error('todo');
            }
            case ResolverResultType.OneToMany: {
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
            case ResolverResultType.ManyToOne: {
              throw new Error('todo');
            }
            case ResolverResultType.ManyToMany: {
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
    }) as U;

    if (clear) {
      this.tables = Pilaf.initTables<A<T>>(Object.keys(resolvers));
    }
    return result;
  }
}
