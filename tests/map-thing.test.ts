import {Thing} from '@suprdata/spec/dist/lib/Thing';
import {model, typed} from '@suprdata/spec/dist/lib/helpers/model';
import {Specification} from '@suprdata/spec/dist/lib/Specification';
import {
  referenceSpecCharValue,
  specCharValueCardinalityDecorator,
  stringSpecCharValue
} from '@suprdata/spec/dist/lib/helpers/specCharValueUse';
import {referenceCharValueUse, simpleCharValueUse} from '@suprdata/spec/dist/lib/helpers/charValueUse';
import {defaultNamingStrategy, mapEntityToThing, mapThing} from '../src/map-thing';

const personType = typed<Specification>(('Common/Person'), {
  '@context': 'Common',
  '@version': '1',
});

const coachSpec: Specification = personType({
  name: 'coach',
  '@id': 'SportsTeam/Coach',
});

const sportsTeamSpec: Specification = personType({
  name: 'sportsTeam',
  '@id': 'SportsTeam',
  specificationCharacteristicValueUse: [
    specCharValueCardinalityDecorator(
      stringSpecCharValue('SportsTeam/Athlete/stadium', 'stadium'),
      {
        minCardinality: 0,
        maxCardinality: 1
      }
    ),
    stringSpecCharValue('SportsTeam/Athlete/awards', 'awards'),
  ]
});

const playerSpec: Specification = personType({
  name: 'player',
  '@id': 'SportsTeam/Athlete',
  specificationCharacteristicValueUse: [
    specCharValueCardinalityDecorator(
      stringSpecCharValue('SportsTeam/Athlete/age', 'age'),
      {
        minCardinality: 0,
        maxCardinality: 1
      }
    ),
    specCharValueCardinalityDecorator(
      referenceSpecCharValue('SportsTeam', 'team', sportsTeamSpec),
      {
        minCardinality: 0,
        maxCardinality: 1
      }
    ),
    referenceSpecCharValue('SportsTeam/Coach', 'coach', coachSpec)
  ]
});

const baseAthelete = model<Thing>({
  specification: playerSpec
});
const baseCoach = model<Thing>({
  specification: coachSpec
});
const baseSportsTeam = model<Thing>({
  specification: sportsTeamSpec
});

const athlete: Thing = baseAthelete({
  '@id': 'harry_kane',
  name: 'Harry Kane',
  subThings: [],
  characteristicValueUse: [
    simpleCharValueUse('SportsTeam/Athlete/age', ['28']),
    referenceCharValueUse('SportsTeam', [
      baseSportsTeam({
        '@id': 'tottenham',
        name: 'Tottenham Hotspur',
        characteristicValueUse: [
          simpleCharValueUse('SportsTeam/Athlete/stadium', ['Tottenham Hotspur Stadium']),
          simpleCharValueUse('SportsTeam/Athlete/awards', ['A', 'B', 'C']),
        ]
      })
    ]),
    referenceCharValueUse('SportsTeam/Coach', [
      baseCoach({'@id': 'santo', name: 'Espirito Santo'}),
    ])
  ]
});

const genericEntity = {
  id: 'harry_kane',
  name: 'Harry Kane',
  coach: [
    {
      id: 'santo',
      name: 'Espirito Santo'
    }
  ],
  team: {
    id: 'tottenham',
    name: 'Tottenham Hotspur',
    stadium: 'Tottenham Hotspur Stadium',
    awards: ['A', 'B', 'C']
  },
  age: '28'
}

describe('thing-map', () => {
  test('should map a complex thing into an multilevel model', () => {
    const target = mapThing<Record<string, unknown>>(defaultNamingStrategy)(athlete);

    expect(target).toEqual(genericEntity);
  });

  test('should map a object to thing', () => {
    const target = mapEntityToThing<Record<string, unknown>>(playerSpec, defaultNamingStrategy)(genericEntity);

    expect(target['@id']).toEqual(athlete['@id']);
    expect(target.name).toEqual(athlete.name);
    expect(target.characteristicValueUse[0]).toMatchObject(athlete.characteristicValueUse[2]);
    expect(target.characteristicValueUse[1]).toMatchObject(athlete.characteristicValueUse[1]);
    expect(target.characteristicValueUse[2]).toMatchObject(athlete.characteristicValueUse[0]);
  });
});
