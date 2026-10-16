import { expect, test } from 'bun:test';
import { life360Fixture } from './life360-fixtures';
import { hiddenMembersText, initialsColor, memberAgeLabel, membersMenuList, refreshAllowed, sortMembersForList } from './life360';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const members = life360Fixture('linked', NOW).members.members;

test('initialsColor: the same colour for the same member, different for neighbours', () => {
  expect(initialsColor('m-lars')).toBe(initialsColor('m-lars'));
  expect(initialsColor('a')).not.toBe(initialsColor('b'));
  expect(initialsColor('m-lars')).toMatch(/^#[0-9a-f]{6}$/);
});

test('memberAgeLabel: short age, "uit" when not sharing', () => {
  expect(memberAgeLabel(members.find((member) => member.id === 'm-mila')!, NOW)).toBe('2 min');
  expect(memberAgeLabel(members.find((member) => member.id === 'm-noor')!, NOW)).toBe('nu');
  expect(memberAgeLabel(members.find((member) => member.id === 'm-tess')!, NOW)).toBe('uit');
});

test('refreshAllowed: no limit, or the limit has passed', () => {
  expect(refreshAllowed(null, NOW)).toBe(true);
  expect(refreshAllowed(new Date(NOW - 1).toISOString(), NOW)).toBe(true);
  expect(refreshAllowed(new Date(NOW).toISOString(), NOW)).toBe(true);
  expect(refreshAllowed(new Date(NOW + 30_000).toISOString(), NOW)).toBe(false);
  expect(refreshAllowed('garbage', NOW)).toBe(true);
});

test('sortMembersForList: sharing members first, then by name; the input is untouched', () => {
  const input = [...members].reverse();
  expect(sortMembersForList(input).map((member) => member.name)).toEqual(['Jesse S.', 'Lars B.', 'Mila K.', 'Noor J.', 'Sem D.', 'Tess V.']);
  expect(input[0].name).toBe('Tess V.');
});

test('membersMenuList: only sharing members, sorted by name; counts the rest', () => {
  const { sharing, hiddenCount } = membersMenuList([...members].reverse());
  expect(sharing.map((member) => member.name)).toEqual(['Jesse S.', 'Lars B.', 'Mila K.', 'Noor J.', 'Sem D.']);
  expect(hiddenCount).toBe(1);
  expect(membersMenuList([])).toEqual({ sharing: [], hiddenCount: 0 });
});

test('hiddenMembersText: singular and plural', () => {
  expect(hiddenMembersText(1)).toBe('+ 1 lid deelt geen locatie');
  expect(hiddenMembersText(27)).toBe('+ 27 leden delen geen locatie');
});
