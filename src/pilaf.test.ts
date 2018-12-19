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
const users = [{id: 0, name: 'aiueo'}, {id: 1, name: 'aaaa'}];
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
    users: ({userHobbies}) => [userHobbies('userId').manyToMany('id')],
    userHobbies: ({users}) => [users('id', 'user').oneToMany('userId')],
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

  expect(pilaf.tables.users).toBeUndefined();
});

test('select clear=false', () => {
  pilaf.select('users', false);
  expect(pilaf.tables.users).not.toBeUndefined();
});