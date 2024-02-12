import {
  getDefaultRoleForAllowedRoles,
  getGroupsWithMappings,
  getAllAllowedRolesForAuthGroups,
  validateGroupRoleMappings,
  mapGroupsToRoles,
} from '../src/packages/auth/functions';
import { getEnv } from '../src/env';
import { describe, expect, test, vi } from 'vitest';

describe('auth helper function tests', () => {
  test('mock env', () => {
    const default_roles = ['role_1'];
    vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));

    const { DEFAULT_ROLE } = getEnv();

    expect(DEFAULT_ROLE[0]).toBe('role_1');
  });

  test('test default role priority', () => {
    const default_roles = ['role_1', 'role_2'];
    const allowed_roles = ['role_2', 'role_1'];

    vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));

    expect(getDefaultRoleForAllowedRoles(allowed_roles)).toBe('role_1');
  });

  test('test auth group filter only considers groups that have a mapping', () => {
    const auth_groups = ['ldap_example_admins', 'ldap_example_users'];
    const group_role_mapping = {
      ldap_example_admins: ['role_1', 'role_2'],
      ldap_example_viewers: ['role_3'],
    };

    vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

    expect(getGroupsWithMappings(auth_groups)).toStrictEqual(['ldap_example_admins']);
  });

  test('correct union of all allowed roles for auth groups', () => {
    const auth_groups = ['ldap_example_admins', 'ldap_example_viewers'];
    const group_role_mapping = {
      ldap_example_admins: ['role_1', 'role_2'],
      ldap_example_viewers: ['role_2', 'role_3'],
    };

    vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

    expect(getAllAllowedRolesForAuthGroups(auth_groups)).toStrictEqual(['role_1', 'role_2', 'role_3']);
  });

  test('group -> role mapping that doesnt contain default role throws error', () => {
    const default_roles = ['role_1'];
    const group_role_mapping = {
      ldap_example_admins: ['role_1', 'role_2'],
      ldap_example_viewers: ['role_2', 'role_3'],
    };

    vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));
    vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

    expect(() => validateGroupRoleMappings()).toThrowError(
      'No roles within DEFAULT_ROLE list were found in the group to role mapping.',
    );
  });

  describe('reference example', () => {
    const default_roles = ['viewer', 'user', 'aerie_admin'];
    const group_role_mapping = {
      group_A: ['viewer', 'user'],
      group_B: ['user'],
      group_C: ['aerie_admin', 'user'],
      group_D: ['viewer'],
      group_E: ['some_other_role'],
    };

    test('error is throw since group_E doesnt contain a default role', () => {
      vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));
      vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

      expect(() => validateGroupRoleMappings()).toThrowError('group_E');
    });

    test('user with only group_C auth group membership', () => {
      vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));
      vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

      const group_C_roles = mapGroupsToRoles(['group_C']);
      expect(group_C_roles.allowed_roles).toContain('aerie_admin');
      expect(group_C_roles.allowed_roles).toContain('user');
      expect(group_C_roles.default_role).toBe('user');
    });

    test('user with group B and D auth group membership', () => {
      vi.stubEnv('DEFAULT_ROLE', JSON.stringify(default_roles));
      vi.stubEnv('AUTH_GROUP_ROLE_MAPPINGS', JSON.stringify(group_role_mapping));

      const group_BD_roles = mapGroupsToRoles(['group_B', 'group_D']);
      expect(group_BD_roles.allowed_roles).toContain('user');
      expect(group_BD_roles.allowed_roles).toContain('viewer');
      expect(group_BD_roles.default_role).toBe('viewer');
    });
  });
});
