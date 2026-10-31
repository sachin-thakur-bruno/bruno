/**
 * Page objects: the only page-object entry point specs import.
 *
 * Temporary bridge: re-exports the current page layer in tests/utils/page.
 * As each region moves into playwright/pages/, export it from here instead.
 */
export * from '../../tests/utils/page';
export * from '../../tests/utils/page/openapi/render-spec';
export * from './response-example';
