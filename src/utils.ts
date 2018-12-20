export type ArrayedObject<T extends {[x: string]: any}> = {[P in keyof T]: T[P][]};
/**
 * @alias
 */
export type A<T extends {[x: string]: any}> = ArrayedObject<T>;