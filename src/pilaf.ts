import produce from 'immer';

type ArrayedObject<T extends object> = {[P in keyof T]: T[P][]};
/**
 * @alias
 */
type A<T extends object> = ArrayedObject<T> & {[x: string]: object[]};

export class Pilaf<
  T extends object,
  R extends Record<
    keyof T,
    (
      handlers: {
        [P in keyof T]: (
          name: keyof T[P],
          bind: string,
        ) => {[x: string]: [string, string]} | void
      },
    ) => {[x: string]: [string, string]} | void
  > = Record<
    keyof T,
    (
      handlers: {
        [P in keyof T]: (
          name: keyof T[P],
          bind: string,
        ) => {[x: string]: [string, string]} | void
      },
    ) => {[x: string]: [string, string]} | void
  >
> {
  tables: A<T>;

  constructor(public readonly resolvers: R) {
    this.tables = produce<A<T>>(draft => {
      Object.keys(resolvers).forEach(key => {
        (draft as any)[key] = [];
      });
    })({} as any);
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

  select(name: keyof T) {
    const cb = this.resolvers[name];

    const keys = Object.keys(this.tables) as (keyof T)[];
    const tableHandlers = keys.reduce(
      (result, key) => {
        result[key] = (name, base) => {
          return {[base]: [key as string, name as string]};
        };
        return result;
      },
      {} as {
        [P in keyof T]: (
          name: keyof T[P],
          base: string,
        ) => {[x: string]: [string, string]}
      },
    );

    const pairs = cb(tableHandlers);
    if (pairs === undefined) {
      throw new Error('todo');
    }

    return this.tables[name].map((item: {[x: string]: any}) => {
      return Object.keys(item).reduce(
        (result, key) => {
          if (pairs[key] === undefined) {
            result[key] = item[key];
          } else {
            const [tableName, bindKey] = pairs[key];
            if (!Array.isArray(result[tableName])) {
              result[tableName] = [];
            }
            result[tableName] = this.tables[tableName];

            return result;
          }

          return result;
        },
        {} as any,
      );
    });
  }
}
