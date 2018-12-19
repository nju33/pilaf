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

let pilaf: Pilaf<InputSchema, OutputSchema>;
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
  pilaf = new Pilaf<InputSchema, OutputSchema>({
    users: ({userHobbies}) => [userHobbies('userId', 'hobbies').many('id')],
    userHobbies: ({users}) => [users('id', 'user').one('userId')],
  });
  pilaf.add('users', users[0]);
  pilaf.add('users', users[1]);
  pilaf.add('userHobbies', userHobbies[0]);
  pilaf.add('userHobbies', userHobbies[1]);
  pilaf.add('userHobbies', userHobbies[2]);
});

test('removeBy.id', () => {
  expect(pilaf.tables.users).toMatchObject(users);
  pilaf.removeBy('users').id(0);
  expect(pilaf.tables.users).toMatchObject([users[1]]);
});

test('one resolve', () => {
  const userHobbies = pilaf.select('userHobbies');
  expect(userHobbies).toMatchObject([
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
});

test('many resolve', () => {
  const users = pilaf.select('users');
  expect(users).toMatchObject([
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
});

test('select [clear=true]', () => {
  expect(pilaf.select('userHobbies')).toMatchObject([
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

  expect(pilaf.tables.users).toBeInstanceOf(Array);
  expect(pilaf.tables.users).toHaveLength(0);
});

test('select clear=false', () => {
  pilaf.select('users', false);
  expect(pilaf.tables.users).toBeInstanceOf(Array);
  expect(pilaf.tables.users).not.toHaveLength(0);
});

test('clear', () => {
  pilaf.clear();
  expect(pilaf.tables.users).toBeInstanceOf(Array);
  expect(pilaf.tables.users).toHaveLength(0);
});
