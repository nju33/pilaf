import produce from 'immer';

type ArrayedObject<T extends object> = {[P in keyof T]: T[P][]};
/**
 * @alias
 */
type A<T extends object> = ArrayedObject<T> & {[x: string]: object[]};

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
  one: ResolverHandlerFunction<T, P>;
  many: ResolverHandlerFunction<T, P>;
}

type ResolverHandlers<T extends object> = {
  [P in keyof T]: ResolverHandler<T, P>
};

interface ResolverFunction<T extends object> {
  (handlers: ResolverHandlers<T>): ResolverResult<T>[];
}

type Resolvers<T extends object> = Record<keyof T, ResolverFunction<T>>;

export class Pilaf<
  IS extends object,
  OS extends Record<keyof IS, any>,
  R extends Resolvers<IS> = Resolvers<IS>
> {
  tables: A<IS>;

  static initTables<U>(keys: string[]) {
    return produce<U>(draft => {
      keys.forEach(key => {
        (draft as any)[key] = [];
      });
    })({} as any);
  }

  constructor(public readonly resolvers: R) {
    this.tables = Pilaf.initTables<A<IS>>(Object.keys(resolvers));
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

  /**
   * 関係を構築して返す
   * @param tableName 取得したいテーブル名
   * @param clear テーブルを初期状態に戻すかどうか
   * @returns 関係構築済みのオブジェクト
   */
  select<P extends keyof IS = keyof IS, R extends OS[P][] = OS[P][]>(
    tableName: P,
    clear: boolean = true,
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

    if (clear) {
      this.clear();
    }
    return result;
  }

  clear() {
    this.tables = Pilaf.initTables<A<IS>>(Object.keys(this.tables));
  }
}
