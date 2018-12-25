# pilaf

A store.

[![github](https://badgen.net/badge//nju33,pilaf/000?icon=github&list=1)](https://github.com/nju33/pilaf)
[![npm:version](https://badgen.net/npm/v/pilaf?icon=npm&label=)](https://www.npmjs.com/package/pilaf)
[![typescript](https://badgen.net/badge/lang/typescript/0376c6?icon=npm)](https://www.typescriptlang.org/)
[![ci:status](https://badgen.net/circleci/github/nju33/pilaf)](https://circleci.com/gh/nju33/pilaf)
[![document:typedoc](https://badgen.net/badge/document/typedoc/9602ff)](https://docs--pilaf.netlify.com/)
[![license](https://badgen.net/npm/license/pilaf)](https://github.com/nju33/pilaf/blob/master/LICENSE)
[![browserslist](https://badgen.net/badge/browserslist/chrome,edge/ffd539?list=1)](https://browserl.ist/?q=last+1+chrome+version%2C+last+1+edge+version)

## Usage 

```ts
/**
 * As to prepare of using the `pilaf`
 * 
 * ```sh
 * yarn add pilaf 
 * ```
 */
import Pilaf, {Store, StorePrototypeLikeThis} from 'pilaf';
```

or

```html
<script src="https://unpkg.com/immer/dist/immer.umd.js"></script>
<script src="https://unpkg.com/pilaf/pilaf.js"></script>
<script>
  // Can use the `Pilaf` here.
</script>
```

## Example

```ts
interface InputSchema {
  users: {
    id: number;
    name: string;
    createdAt?: string;
  };
  userHobbies: {
    userId: InputSchema['users']['id'];
    id: number;
    name: string;
  };
}

interface OutputSchema {
  users: {
    id: number;
    name: string;
    createdAt?: string;
    hobbies: InputSchema['userHobbies'];
  };
  userHobbies: {
    user: InputSchema['users'];
    id: number;
    name: string;
  };
}

interface PrototypeLike {
  addUser: (
    this: StorePrototypeLikeThis<InputSchema, PrototypeLike>,
    users: InputSchema['users'] | InputSchema['users'][],
  ) => Store<InputSchema, PrototypeLike>;
}

const userList = [{id: 0, name: 'foo'}, {id: 1, name: 'bar'}];
const userHobbyList = [
  {userId: 0, id: 0, name: 'hoge'},
  {userId: 1, id: 1, name: 'fuga'},
  {userId: 0, id: 2, name: 'piyo'},
];

const pilaf = new Pilaf<InputSchema, OutputSchema, PrototypeLike>({
  users: ({userHobbies}) => [userHobbies('userId', 'hobbies').many('id')],
  userHobbies: ({users}) => [users('id', 'user').one('userId')],
});
const store = pilaf.create<PrototypeLike>({
  addUser(userList) {
    return this(({users}) => {
      users.add(userList);
    });
  }
})(({users, userHobbies}) => {
  users.add(userList);
  userHobbies.add(userHobbyList);
});

expect(store.users).toMatchObject([
  {id: 0, name: 'foo', hobbies: [userHobbies[0], userHobbies[2]]},
  {id: 1, name: 'bar', hobbies: [userHobbies[1]]},
]);

expect(store.userHobbies).toMatchObject([
  {user: users[0], id: 0, name: 'hoge'},
  {user: users[1], id: 1, name: 'fuga'},
  {user: users[0], id: 2, name: 'piyo'},
]);

const updatedStore = store.addUser({id: 2, name: 'baz'})(({users}) => {
  users.add({id: 3, name: 'qux'});
});

expect(updatedStore.users).toHaveLength(3);
expect(store.users).toHaveLength(2);

expect(store).not.toBe(updatedStore);
expect(store).toBe(store(() => {}));

store(({users, userHobbies}) => {
  // users.add(...)
  // users.updateBy('name', 'newFooName')('name', 'foo');
  // users.updateBy('name', 'foofoo').in('id', [0, 1]);
  // users.updateBy('name', 'newName')('id', 0);
  // userHobbies.deleteBy('id').in([0, 1]);
  // users.clear();
});

store.clear();
```