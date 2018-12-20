// import produce from 'immer';
// import {ArrayedObject} from './utils';

// /**
//  * @alias
//  */
// type A<T extends {[x: string]: any}> = ArrayedObject<T>;

// export class Store<IS extends {[x: string]: any}> {
//   static create<IS extends {[x: string]: any}>(keys: (keyof IS)[]): Store<IS> {
//     return new Store<IS>(keys);
//   }

//   private tables: A<IS>;

//   constructor(keys: (keyof IS)[]) {
//     this.tables = produce<A<IS>>(draft => {
//       keys.forEach(key => {
//         (draft as any)[key] = [];
//       });
//     })({} as any);
//   }
// }
