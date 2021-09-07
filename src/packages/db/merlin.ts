import { readFileSync } from 'fs';
import type { Pool } from 'pg';

const baseSqlPath = 'sql/merlin';
const domainTypesPath = `${baseSqlPath}/domain-types`;
const tablesPath = `${baseSqlPath}/tables`;

async function createDomainTypes(pool: Pool): Promise<void> {
  try {
    const merlinArgumentsSql = readFileSync(
      `${domainTypesPath}/merlin-arguments.sql`,
    ).toString();
    await pool.query(merlinArgumentsSql);
  } catch (error) {
    const { message } = error as Error;
    console.log(message);
  }
}

/**
 * Table creation order matters!
 */
async function createTables(pool: Pool): Promise<void> {
  try {
    // Uploaded files (JARs or simulation input files).
    const tableViewSql = readFileSync(
      `${tablesPath}/uploaded_file.sql`,
    ).toString();
    await pool.query(tableViewSql);

    // Planning intents.
    const missionModelSql = readFileSync(
      `${tablesPath}/mission_model.sql`,
    ).toString();
    await pool.query(missionModelSql);

    const planSql = readFileSync(`${tablesPath}/plan.sql`).toString();
    await pool.query(planSql);

    const activitySql = readFileSync(`${tablesPath}/activity.sql`).toString();
    await pool.query(activitySql);

    const simulationSql = readFileSync(
      `${tablesPath}/simulation.sql`,
    ).toString();
    await pool.query(simulationSql);

    // Uploaded datasets (or datasets generated from simulation).
    const datasetSql = readFileSync(`${tablesPath}/dataset.sql`).toString();
    await pool.query(datasetSql);

    const spanSql = readFileSync(`${tablesPath}/span.sql`).toString();
    await pool.query(spanSql);

    const profileSql = readFileSync(`${tablesPath}/profile.sql`).toString();
    await pool.query(profileSql);

    const profileSegmentSql = readFileSync(
      `${tablesPath}/profile_segment.sql`,
    ).toString();
    await pool.query(profileSegmentSql);

    // Analysis intents.
    const conditionSql = readFileSync(`${tablesPath}/condition.sql`).toString();
    await pool.query(conditionSql);

    const profileRequestSql = readFileSync(
      `${tablesPath}/profile_request.sql`,
    ).toString();
    await pool.query(profileRequestSql);

    // Derived tables and process state.

    // Derived by processing an uploaded mission model.
    const missionModelParametersSql = readFileSync(
      `${tablesPath}/mission_model_parameters.sql`,
    ).toString();
    await pool.query(missionModelParametersSql);

    // Derived by simulating a plan.
    const simulationDatasetSql = readFileSync(
      `${tablesPath}/simulation_dataset.sql`,
    ).toString();
    await pool.query(simulationDatasetSql);
  } catch (error) {
    const { message } = error as Error;
    console.log(message);
  }
}

export async function initMerlin(pool: Pool): Promise<void> {
  await pool.query('set search_path to merlin');
  await createDomainTypes(pool);
  await createTables(pool);
}
