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

const users = [{id: 0, name: 'foo'}, {id: 1, name: 'bar'}];
const userHobbies = [
  {userId: 0, id: 0, name: 'hoge'},
  {userId: 1, id: 1, name: 'fuga'},
  {userId: 0, id: 2, name: 'piyo'},
];

const pilaf = new Pilaf<InputSchema, OutputSchema>({
  users: ({userHobbies}) => [userHobbies('userId', 'hobbies').many('id')],
  userHobbies: ({users}) => [users('id', 'user').one('userId')],
});
pilaf.add('users', users[0]);
pilaf.add('users', users[1]);
pilaf.add('userHobbies', userHobbies[0]);
pilaf.add('userHobbies', userHobbies[1]);
pilaf.add('userHobbies', userHobbies[2]);

const userHobbies = pilaf.select('userHobbies', false);
expect(userHobbies).toMatchObject([
  {id: 0, name: 'プログラミング', user: users[0]},
  {id: 1, name: 'ゲーム', user: users[1]},
  {id: 2, name: '料理', user: users[0]},
]);
// this.tables.userHobbies.length === 3

const users = pilaf.select('users', false);
expect(users).toMatchObject([
  {id: 0, name: 'foo', hobbies: [userHobbies[0], userHobbies[2]]},
  {id: 1, name: 'bar', hobbies: [userHobbies[1]]},
]);
// this.tables.users.length === 2

pilaf.clear();
// this.tables.users.length === 0
// this.tables.userHobbies.length === 0
```