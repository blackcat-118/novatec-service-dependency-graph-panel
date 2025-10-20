import { DataFrame } from '@grafana/data';
import _, { filter } from 'lodash';
import { PanelController } from '../panel/PanelController';
import { GraphDataElement, GraphDataType, CurrentData } from '../types';
import { sourceMapsEnabled } from 'process';

var upfN4IPIDMapping: { [key: string]: string 
} = { 
  '10.100.50.144': 'upf1', 
  '10.100.50.145': 'upf2', 
  '10.100.50.146': 'upf3', 
  '10.100.50.147': 'upf4', 
  '10.100.50.148': 'upf5', 
  '10.100.50.149': 'upf6', 
};

// key is upf pod name(e.g 'upf-0')
var upfNameInfoMapping: {
  [key: string]: {
    upf_id: string;
    n4_ip: string;
    session_count?: number;
    cpu_usage?: number;
    [extraKey: string]: any; // optional: allow extra fields
  };
} = {
  // 'upf1': { upf_id:'upf1', n4_ip: '10.100.50.144', session_count: 0 },
};

class PreProcessor {
  controller: PanelController;

  constructor(controller: PanelController) {
    this.controller = controller;
  }

  _transformObjects(data: any[]): GraphDataElement[] {
    const {
      aggregationType,
      interfaceColumn,
      namespaceDelimiter,
    } = this.controller.getSettings(true).dataMapping;

    const result = _.flatMap(data, (dataObject) => {
      // preprocessing the source and target columns
      // to remove the namespace string from the source and target columns
      // and replace it with the namespaceDelimiter

      // if (dataObject[aggregationType] !== '') {
      //   const aggValue = dataObject[aggregationType];
      //   const aggResovled = aggValue.split('-');
      //   if (aggResovled.length >= 3) {
      //     dataObject[aggregationType] = aggResovled[aggResovled.length-3];
      //     source = dataObject[aggregationType];
      //   }
      // }
      // Don't use extSource and extTarget for 5G Digital Twin
      // because they are not used in the data mapping

      const result: GraphDataElement = {
        target: '',
        data: dataObject,
        type: GraphDataType.INTERNAL,
      };

      if (_.has(dataObject, 'namespace')) {
        const nameSpace = _.get(dataObject, 'namespace');
        if (nameSpace) {
          const namespaceResolved = nameSpace.split(namespaceDelimiter);
          result.namespace = namespaceResolved;
        }
      }
      result.source = dataObject[aggregationType];
      const sbiExclude: string[] = ['ue', 'upf1', 'upf2', 'upf3', 'upf4', 'upf5', 'upf6', 'ue', 'gnb', 'gnb1', 'gnb2', 'dbpython', 'mongodb-0'];
      // Only consider container network receive 
      result.type = GraphDataType.INTERNAL;
      if (dataObject[interfaceColumn] !== "") {
        if (dataObject[interfaceColumn] === "n2") {
          if (result.source?.includes("gnb")) {
            result.target = "amf";

            // return 2 results, one for incoming, one for outgoing
            return [
              result,
              {
                ...result,
                source: result.target,
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
                // type: GraphDataType.EXTERNAL_OUT
              },
            ];
          } else if (result.source?.includes("amf")) {
            return null; // skip this row, as it is handled in the gnb<-amf case
            // result.type = GraphDataType.EXTERNAL_OUT
          }
        } else if (dataObject[interfaceColumn] === "n3") {
          if (result.source?.includes("upf")) {

            // cannot know which gnb the traffic sent to, so set to all gnb...
            // assume gnb1, gnb2 and gnb3 for now
            return [
              {
                ...result,
                target: "gnb"
              },
              {
                ...result,
                target: "gnb1"
              },
              {
                ...result,
                target: "gnb2"
              }
            ]
          } else if (result.source?.includes("gnb")) {
            // the same reason as above, cannot know which upf the traffic comes from
            const tmp_result: any = [];
            for (const [_, info] of Object.entries(upfNameInfoMapping)) {
              tmp_result.push({
                ...result,
                target: info.upf_id,
              });
            }
            return tmp_result;
          }
        } else if (dataObject[interfaceColumn] === "n4") {
          if (result.source?.includes("upf")) {
            result.target = "smf";
            return [
              result,
              {
                ...result,
                source: result.target,
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
              }
            ]
          } else if (result.source?.includes("smf")) {
            return null; // skip this row, as it is handled in the upf<-smf case
          }
        } else if (dataObject[interfaceColumn] === "n6") {
          result.target = "DN"
          result.type = GraphDataType.EXTERNAL_OUT
        } else if (
          typeof dataObject[interfaceColumn] === 'string' &&
          dataObject[interfaceColumn].includes('uesimtun')
        ) {
          if (result.source?.includes("gnb")) {
            // result.target = "ue"
            // return [
            //   result,
            //   {
            //     ...result,
            //     source: result.target,
            //     target: result.source,
            //     data: {
            //       ...dataObject,
            //       // clear out metrics and keep only incoming ones
            //       'bandwidth_out': undefined,
            //       'rate_out': undefined,
            //     }
            //   },
            // ]
            // result.type = GraphDataType.EXTERNAL_OUT
          } else if (result.source?.includes("ue")) {
            return [
              {
                ...result,
                target: "gnb"
              },
              {
                ...result,
                source: "gnb",
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
              },
              {
                ...result,
                target: "gnb1"
              },
              {
                ...result,
                source: "gnb1",
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
              },
              {
                ...result,
                target: "gnb2"
              },
              {
                ...result,
                source: "gnb2",
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
              },
            ]
            // result.type = GraphDataType.EXTERNAL_OUT
          }
        } else {
          if (result.source && !sbiExclude.includes(result.source)) {
            result.target = "SBI"
            return [
              result,
              {
                ...result,
                source: result.target,
                target: result.source,
                data: {
                  ...dataObject,
                  // clear out metrics and keep only incoming ones
                  'bandwidth_out': undefined,
                  'rate_out': undefined,
                }
              },
            ]
            // result.type = GraphDataType.EXTERNAL_OUT
          } else {
            return null;
            // result.type = GraphDataType.EXTERNAL_OUT
          }
        }
      }

      return result;
    });

    const filteredResult: GraphDataElement[] = result.filter(
      (element): element is GraphDataElement => element !== null
    );
    return filteredResult;
  }

  _mergeGraphData(data: GraphDataElement[]): GraphDataElement[] {
    const groupedData = _.values(_.groupBy(data, (element) => element.source + '<--->' + element.target));

    const mergedData = _.map(groupedData, (group) => {
      return _.reduce(group, (result, next) => {
        return _.merge(result, next);
      });
    });

    return mergedData;
  }

  _cleanMetaData(columnMapping: any, metaData: any) {
    const result: any = {};

    _.forOwn(columnMapping, (value, key) => {
      if (_.has(metaData, value)) {
        result[key] = metaData[value];
      }
    });

    return result;
  }

  _extractColumnNames(data: GraphDataElement[]): string[] {
    const columnNames: string[] = _(data)
      .flatMap((dataElement) => _.keys(dataElement.data))
      .uniq()
      .sort()
      .value();

    return columnNames;
  }

  _getField(fieldName: string, fields: any[]) {
    for (const field of fields) {
      if (field.name === fieldName) {
        return field;
      }
    }
    return undefined;
  }

  _mergeSeries(series: any[]) {
    var mergedSeries: any = undefined;
    for (const seriesElement of series) {
      if (mergedSeries === undefined) {
        mergedSeries = seriesElement;
      } else {
        for (const field of seriesElement.fields) {
          const mergedField = this._getField(field.name, mergedSeries.fields);
          if (mergedField === undefined) {
            mergedSeries.fields.push(field);
          } else {
            mergedField.values = _.concat(field.values, mergedField.values);
          }
        }
      }
    }
    return mergedSeries;
  }

  _dataToRows(inputDataSets: any) {
    var rows: any[] = [];

    const {
      aggregationType,
      interfaceColumn,
      namespaceColumn,
      type,
      errorRateColumn,
      errorRateOutgoingColumn,
      cpuUsageColumn,
      responseTimeColumn,
      responseTimeOutgoingColumn,
      requestRateColumn,
      requestRateOutgoingColumn,
      baselineRtUpper,
    } = this.controller.getSettings(true).dataMapping;

    // filter out UPF info data
    const filteredInputDataSets: any[] = []
    // extract UPF info first
    for (const inputData of inputDataSets) {
      const upfname = inputData.name; 
      if (!upfname) {
        filteredInputDataSets.push(inputData);
        continue;
      }

      const { fields } = inputData;
      const upfN4IPField = _.find(fields, ['name', 'n4_ip']);
      const upfSessionCountField = _.find(fields, ['name', 'session_count'])

      if (!upfNameInfoMapping[upfname]) {
        upfNameInfoMapping[upfname] = {
          upf_id: '',
          n4_ip: '',
          session_count: 0,
        };
      }

      for (let i = 0; i < inputData.length; i++) {
        if (upfN4IPField || upfSessionCountField) {
          upfNameInfoMapping[upfname].upf_id = upfN4IPIDMapping[upfN4IPField?.values.get(i)];
          upfNameInfoMapping[upfname].n4_ip = upfN4IPField?.values.get(i);
          upfNameInfoMapping[upfname].session_count = upfSessionCountField?.values.get(i);
        }
      }
    }

    for (const inputData of filteredInputDataSets) {
      const { fields } = inputData;
      const aggregationSuffixField = _.find(fields, ['name', aggregationType]);

      const typeField = _.find(fields, ['name', type]);

      const interfaceColumnField = _.find(fields, ['name', interfaceColumn]);
      const namespaceColumnField = _.find(fields, ['name', namespaceColumn]);
      const nodeIPColumnField = _.find(fields, ['name', 'host_ip']);
      const podIPColumnField = _.find(fields, ['name', 'pod_ip']);

      const errorRateColumnField = _.find(fields, ['name', errorRateColumn]);
      const errorRateOutgoingColumnField = _.find(fields, ['name', errorRateOutgoingColumn]);
      const cpuUsageColumnField = _.find(fields, ['name', cpuUsageColumn]);
      const responseTimeColumnField = _.find(fields, ['name', responseTimeColumn]);
      const responseTimeOutgoingColumnField = _.find(fields, ['name', responseTimeOutgoingColumn]);
      const requestRateColumnField = _.find(fields, ['name', requestRateColumn]);
      const bandwidthColumnField = _.find(fields, ['name', 'Value #bandwidth_in']);
      const requestRateOutgoingColumnField = _.find(fields, ['name', requestRateOutgoingColumn]);
      const bandwidthOutgoingColumnField = _.find(fields, ['name', 'Value #bandwidth_out']);
      const responseTimeBaselineField = _.find(fields, ['name', baselineRtUpper]);

      for (let i = 0; i < inputData.length; i++) {
        const row: any = {};
        row[aggregationType] = aggregationSuffixField?.values.get(i);
        // skip rows with empty aggregation type(pod name)
        if (!row[aggregationType] || row[aggregationType] === '') {
          continue;
        }

        // skip rows that are not related to free5gc or ueransim
        if (!row[aggregationType].includes('free5gc') && !row[aggregationType].includes('ueransim')) {
          continue;
        }

        // normalize the aggregation type value
        if (row[aggregationType].includes('upf')) {
          // 'free5gc-premier-free5gc-upf-upf-0' -> 'upf-0'
          row[aggregationType] = row[aggregationType]
                                .split('-')
                                .slice(-2)
                                .join('-');
          const upf_name: string = row[aggregationType];
          row['n4_ip'] = upfNameInfoMapping[upf_name]?.n4_ip;
          row['session_count'] = upfNameInfoMapping[upf_name]?.session_count;
          // update aggregationType to upf id in smf configuration
          row[aggregationType] = upfNameInfoMapping[upf_name]?.upf_id;

        } else if (row[aggregationType].includes('ueransim')) {
          // 'ueransim-premier-gnb-67847595df-vp2tc' -> 'gnb'
          row[aggregationType] = row[aggregationType].split('-')[2];
        } else if (row[aggregationType].includes('free5gc')) {
          // 'free5gc-premier-free5gc-amf-amf-6bc4b64f86-vk6bk ' -> 'amf'
          row[aggregationType] = row[aggregationType].split('-')[4];
        }

        row[aggregationType]
        row[interfaceColumn] = interfaceColumnField?.values.get(i);
        row['node_ip'] = nodeIPColumnField?.values.get(i);
        row['pod_ip'] = podIPColumnField?.values.get(i);
        row['namespace'] = namespaceColumnField?.values.get(i);
        row['error_rate_in'] = errorRateColumnField?.values.get(i);
        row['error_rate_out'] = errorRateOutgoingColumnField?.values.get(i);
        row['cpu_usage'] = cpuUsageColumnField?.values.get(i);
        row['response_time_in'] = responseTimeColumnField?.values.get(i);
        row['response_time_out'] = responseTimeOutgoingColumnField?.values.get(i);
        row['rate_in'] = requestRateColumnField?.values.get(i);
        row['rate_out'] = requestRateOutgoingColumnField?.values.get(i);
        row['bandwidth_in'] = bandwidthColumnField?.values.get(i);
        row['bandwidth_out'] = bandwidthOutgoingColumnField?.values.get(i);
        row['threshold'] = responseTimeBaselineField?.values.get(i);
        row['type'] = typeField?.values.get(i);

        // The above code returns { "": undefined } for values that do not exist.
        // These values are filtered by this line.
        Object.keys(row).forEach((key) => (row[key] === undefined || row[key] === '') && delete row[key]);
        rows.push(row);
      }
    }
    return rows;
  }

  _mergeObjects(rows: any[]) {
    var mergedObjects: any[] = [];

    for (const row of rows) {
      mergedObjects.push(row);
    }
    return mergedObjects;
  }

  _extractUPFInfo(inputData: any[]) {
    const upfInfo: any = {};

    for (const dataObject of inputData) {
      const upfName = dataObject['upf_name'];
      if (upfName && !_.has(upfInfo, upfName)) {
        upfInfo[upfName] = {
          pod_ip: dataObject['pod_ip'],
          node_ip: dataObject['node_ip'],
        };
      }
    }
  }

  processData(inputData: DataFrame[]): CurrentData {
    const rows = this._dataToRows(inputData);

    const flattenData = this._mergeObjects(rows);
    
    const graphElements = this._transformObjects(flattenData);
    
    const columnNames = this._extractColumnNames(graphElements);
    
    const mergedData = this._mergeGraphData(graphElements);
    console.log('Merged Data:', mergedData);
    
    return {
      graph: mergedData,
      raw: inputData,
      columnNames: columnNames,
    };
  }
}

export default PreProcessor;
