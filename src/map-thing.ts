import {SpecificationCharacteristicValueUse} from '@suprdata/spec/dist/lib/SpecificationCharacteristicValueUse';
import {CharacteristicValueResource} from '@suprdata/spec/dist/lib/CharacteristicValueResource';
import {Thing} from '@suprdata/spec/dist/lib/Thing';
import {CharacteristicValueUse} from '@suprdata/spec/dist/lib/CharacteristicValueUse';
import {CharacteristicValue} from '@suprdata/spec/dist/lib/CharacteristicValue';
import {Specification} from '@suprdata/spec/dist/lib/Specification';
import {mapObject} from '@suprcrew/super-map';
import {
  referenceCharValueUse,
  resourceCharValueUse,
  simpleCharValueUse
} from '@suprdata/spec/dist/lib/helpers/charValueUse';

export type MapSourceToTargetFunction<S, T> = (source: S) => T;
export type MapKeyNamingStrategy = (valueSpec: SpecificationCharacteristicValueUse) => string;

export const defaultNamingStrategy = (valueSpec: SpecificationCharacteristicValueUse): string => String(valueSpec['name'] || valueSpec['@id']) as string;

export function mapThing<T extends Record<string, unknown>>(namingStrategy: MapKeyNamingStrategy = defaultNamingStrategy): MapSourceToTargetFunction<Thing, T> {
  return (thing: Thing): T => {
    const source = thing.characteristicValueUse || [];
    // const target: Record<string, unknown> = ;

    const specValueUseIndex: { [key: string]: SpecificationCharacteristicValueUse } = indexSpecificationValueUse(thing?.specification);

    return source.reduce<Record<string, unknown>>((target, value: CharacteristicValueUse) => {
      const {commonCharValues, commonSpecCharValueUse} = value;
      const valueSpec = specValueUseIndex[commonSpecCharValueUse['@id']];
      if (!valueSpec) {
        return target;
      }
      if (!valueSpec?.specificationCharacteristicValue?.visible) {
        return target;
      }

      const targetValue = commonCharValues.map((val: CharacteristicValue) => {
        if (valueSpec.isReference) {
          // Deep construction of a thing
          return mapThing(namingStrategy)(val.characteristicValueReference);
        } else if (valueSpec.isResource) {
          return val.characteristicValueResource;
        } else {
          return val.value;
        }
      });

      target[defaultNamingStrategy(valueSpec)] = valueByCardinality(valueSpec)(targetValue);
      return target;
    }, {
      id: thing['@id'],
      name: thing.name,
    } as Record<string, unknown>) as unknown as T;

    // return target as T;
  };
}

const valueByCardinality = (valueSpec: SpecificationCharacteristicValueUse) => (val: any[] | CharacteristicValueResource [] | Thing[]) => {
  const min = Number((valueSpec || {minCardinality: 0})?.minCardinality);
  const max = Number((valueSpec || {maxCardinality: 0})?.maxCardinality);
  if (0 < max - min) {
    return val[0]
  } else {
    return val;
  }
}

function indexSpecificationValueUse(spec: Specification): { [key: string]: SpecificationCharacteristicValueUse } {
  const specValueUse: SpecificationCharacteristicValueUse[] = spec?.specificationCharacteristicValueUse || [];
  const specValueUseIndex: { [key: string]: SpecificationCharacteristicValueUse } = {};
  specValueUse.forEach((valueUse: SpecificationCharacteristicValueUse) => {
    specValueUseIndex[String(valueUse['@id'])] = valueUse;
  });

  return specValueUseIndex;
}

export function mapEntityToThing<T extends Record<string, unknown>>(spec: Specification, namingStrategy: MapKeyNamingStrategy): MapSourceToTargetFunction<T, Thing> {
  return (structure: T): Thing => {
    const target: Thing = mapObject<Thing>({
      '@id': 'id',
      'name': 'name',
      specification: () => spec,
      characteristicValueUse: () => [],
    }, structure as unknown as object);

    const specValueUseIndex: { [key: string]: SpecificationCharacteristicValueUse } = indexSpecificationValueUse(spec);
    const specValueUseNameToIdIndex: { [key: string]: string } = {};

    Object.keys(specValueUseIndex).forEach((key) => {
      specValueUseNameToIdIndex[String(namingStrategy(specValueUseIndex[key]))] = key;
    });

    Object.keys(structure).forEach((key) => {
      const correspondingValueSpecId = specValueUseNameToIdIndex[key];
      const correspondingValueSpec: SpecificationCharacteristicValueUse = specValueUseIndex[correspondingValueSpecId];

      // ignore unknown spec
      if (correspondingValueSpec === undefined) {
        return;
      }

      const correspondingValue = structure[key];

      const composeCharValue = (specCharValUse: SpecificationCharacteristicValueUse, val: any) => {
        const min = Number((specCharValUse || {minCardinality: 0})?.minCardinality);
        const max = Number((specCharValUse || {maxCardinality: 0})?.maxCardinality);

        if (specCharValUse.isReference) {

          const refSpec = specCharValUse?.specificationCharacteristicValue?.valueReferenceSpecification;
          // Deep construction of a thing
          if (0 < max - min) {
            return referenceCharValueUse(correspondingValueSpecId, [mapEntityToThing<T>(refSpec, namingStrategy)(val)]);
          } else {
            return referenceCharValueUse(correspondingValueSpecId, (val || []).map(mapEntityToThing<T>(refSpec, namingStrategy)));
          }
        } else if (specCharValUse.isResource) {
          return resourceCharValueUse(correspondingValueSpecId, 0 < max - min ? [val] : val);
        } else {
          return simpleCharValueUse(correspondingValueSpecId, 0 < max - min ? [val] : val);
        }
      }

      target.characteristicValueUse.push(composeCharValue(correspondingValueSpec, correspondingValue));

      return;
    })

    return target;
  }
}
