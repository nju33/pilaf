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

beforeEach(() => {
  pilaf = new Pilaf<Schema>({
    users: ({userHobbies}) => userHobbies('userId', 'id'),
    userHobbies: ({users}) => users('id', 'userId'),
  });
});

test('pilaf', () => {
  const users = [{id: 0, name: 'aiueo'}, {id: 1, name: 'aaaa'}];
  const userHobbies = [
    {
      userId: 0,
      id: 0,
      name: 'プログラミング',
    },
  ];
  pilaf.add('users', users[0]);
  pilaf.add('users', users[1]);
  pilaf.add('userHobbies', userHobbies[0]);

  expect(pilaf.tables.users).toMatchObject(users);

  pilaf.removeBy('users').id(0);
  expect(pilaf.tables.users).toMatchObject([users[1]]);

  console.log(JSON.stringify(pilaf.select('userHobbies')));
});
