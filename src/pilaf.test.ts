import {Pilaf} from './pilaf';

interface Schema {
  users: {
    id: number;
    name: string;
    createdAt?: string;
  };
  userHobbies: {
    userId: Schema['users']['id'];
    id: number;
    name: string;
  };
}

let pilaf: Pilaf<Schema>;
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
  pilaf = new Pilaf<Schema>({
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
  const userHobbies = pilaf.select<
    Pick<
      Schema['userHobbies'],
      Exclude<keyof Schema['userHobbies'], 'userId'>
    > & {user: Schema['users'][]}
  >('userHobbies');
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
  const users = pilaf.select<
    Schema['users'] & {hobbies: Schema['userHobbies'][]}
  >('users');
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
  expect(
    pilaf.select<
      Exclude<Schema['userHobbies'], 'userId'> & {user: Schema['users'][]}
    >('userHobbies'),
  ).toMatchObject([
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
