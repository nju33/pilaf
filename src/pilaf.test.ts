import {Pilaf} from './pilaf';

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

let pilaf = new Pilaf<InputSchema, OutputSchema>({
  users: ({userHobbies}) => [userHobbies('userId', 'hobbies').many('id')],
  userHobbies: ({users}) => [users('id', 'user').one('userId')],
});
let store: ReturnType<Pilaf<InputSchema, OutputSchema>['create']>;
const users = [{id: 0, name: 'foo'}, {id: 1, name: 'bar'}];
const userHobbies = [
  {
    id: 0,
    name: 'プログラミング',
    userId: 0,
  },
  {
    id: 1,
    name: 'ゲーム',
    userId: 1,
  },
  {
    id: 2,
    name: '料理',
    userId: 0,
  },
];

beforeEach(() => {
  store = pilaf.create();
  const userList = users;
  const userHobbyList = userHobbies;

  store = store(({users, userHobbies}) => {
    users.add(userList[0]);
    users.add(userList[1]);
    userHobbies.add(userHobbyList[0]);
    userHobbies.add(userHobbyList[1]);
    userHobbies.add(userHobbyList[2]);
  });
});

test('set & get items', () => {
  expect(store.users).toMatchObject([
    {
      id: 0,
      name: 'foo',
      hobbies: [userHobbies[0], userHobbies[2]],
    },
    {
      id: 1,
      name: 'bar',
      hobbies: [userHobbies[1]],
    },
  ]);

  expect(store.userHobbies).toMatchObject([
    {
      id: 0,
      name: 'プログラミング',
      user: users[0],
    },
    {
      id: 1,
      name: 'ゲーム',
      user: users[1],
    },
    {
      id: 2,
      name: '料理',
      user: users[0],
    },
  ]);

  const alias = store(() => {});
  expect(alias).toBe(store);
});

test('clear all', () => {
  store = store.clear();
  expect(store.users).toHaveLength(0);
  expect(store.userHobbies).toHaveLength(0);
});

test('clear', () => {
  store = store(({users}) => {
    users.clear();
  });

  expect(store.users).toHaveLength(0);
  expect(store.userHobbies).toHaveLength(3);
});

test('updateBy()()', () => {
  const updatedStore = store(({users}) => {
    users.updateBy('name', 'foofoo')('foo');
  });

  expect(store.users.find(user => user.name === 'foofoo')).toBeUndefined();
  expect(
    updatedStore.users.find(user => user.name === 'foofoo'),
  ).not.toBeUndefined();
});

test('updateBy().in()', () => {
  const updatedStore = store(({users}) => {
    users.updateBy('name', 'foofoo').in(['foo', 'bar']);
  });

  expect(store.users.filter(user => user.name === 'foofoo')).toHaveLength(0);
  expect(
    updatedStore.users.filter(user => user.name === 'foofoo'),
  ).toHaveLength(2);
});

test('deleteBy()()', () => {
  store = store(({users}) => {
    users.deleteBy('id')(0);
  });

  expect(store.users).toHaveLength(1);
});

test('deleteBy().in()', () => {
  store = store(({users, userHobbies}) => {
    users.deleteBy('id').in([0, 1]);
  });

  expect(store.users).toHaveLength(0);
});
