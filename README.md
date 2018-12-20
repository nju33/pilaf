# pilaf

## Install

```ts
yarn add pilaf
```

## Example

```ts
import Pilaf from 'pilaf';

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

const userList = [{id: 0, name: 'foo'}, {id: 1, name: 'bar'}];
const userHobbyList = [
  {userId: 0, id: 0, name: 'hoge'},
  {userId: 1, id: 1, name: 'fuga'},
  {userId: 0, id: 2, name: 'piyo'},
];

const pilaf = new Pilaf<InputSchema, OutputSchema>({
  users: ({userHobbies}) => [userHobbies('userId', 'hobbies').many('id')],
  userHobbies: ({users}) => [users('id', 'user').one('userId')],
});
const store = pilaf.create()(({users, userHobbies}) => {
  users.add(userList[0]);
  users.add(userList[1]);
  userHobbies.add(userHobbyList[0]);
  userHobbies.add(userHobbyList[1]);
  userHobbies.add(userHobbyList[2]);
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

const updatedStore = store(({users}) => {
  users.add({id: 2, name: 'baz'});
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