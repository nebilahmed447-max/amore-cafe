/**
 * Amore Cafe Google Sheets connector
 *
 * Create a Google Spreadsheet with two sheets named:
 *   Products  -> id,name,amharic,category,price,image,description,popular,fasting,available
 *   Orders    -> id,createdAt,customerName,phone,address,notes,total,status,payment,itemsJson
 *
 * Deploy: Extensions -> Apps Script -> Deploy -> New deployment -> Web app
 * Execute as: Me
 * Who has access: Anyone
 * Then use the Web app URL as NEXT_PUBLIC_MENU_API_URL.
 * Publish Products as CSV and use its URL as NEXT_PUBLIC_MENU_CSV_URL.
 */

function doGet(e) {
  const resource=(e && e.parameter && e.parameter.resource) || 'products';
  if(resource==='orders') {
    const sheet=SpreadsheetApp.getActive().getSheetByName('Orders');
    return json_({ok:true,orders:sheet ? sheetToObjects_(sheet) : []});
  }
  const sheet = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sheet) return json_({ok:false,error:'Products sheet not found'});
  return json_({ok:true,products:sheetToObjects_(sheet)});
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || 'order';
    if (action === 'products') return saveProducts_(body.products || []);
    if (action === 'order') return saveOrder_(body.order);
    if (action === 'updateOrder') return updateOrder_(body.id, body.status);
    return json_({ok:false,error:'Unknown action'});
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function saveProducts_(products) {
  const ss=SpreadsheetApp.getActive();
  const sheet=ss.getSheetByName('Products') || ss.insertSheet('Products');
  const headers=['id','name','amharic','category','price','image','description','popular','fasting','available'];
  const values=[headers].concat(products.map(p=>headers.map(h=>p[h] ?? '')));
  sheet.clearContents();
  sheet.getRange(1,1,values.length,headers.length).setValues(values);
  return json_({ok:true,count:products.length});
}

function saveOrder_(order) {
  const ss=SpreadsheetApp.getActive();
  const sheet=ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  const headers=['id','createdAt','customerName','phone','address','notes','total','status','payment','itemsJson'];
  if (sheet.getLastRow()===0) sheet.appendRow(headers);
  sheet.appendRow([
    order.id, order.createdAt, order.customer?.name || '', order.customer?.phone || '',
    order.customer?.address || '', order.customer?.notes || '', order.total || 0,
    order.status || 'Pending', order.payment || 'Cash', JSON.stringify(order.items || [])
  ]);
  return json_({ok:true,id:order.id});
}

function sheetToObjects_(sheet) {
  const values=sheet.getDataRange().getValues();
  if(values.length<2) return [];
  const headers=values[0].map(String);
  return values.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function updateOrder_(id, status) {
  const sheet=SpreadsheetApp.getActive().getSheetByName('Orders');
  if(!sheet) return json_({ok:false,error:'Orders sheet not found'});
  const values=sheet.getDataRange().getValues();
  const idCol=values[0].indexOf('id')+1;
  const statusCol=values[0].indexOf('status')+1;
  for(let r=1;r<values.length;r++) {
    if(String(values[r][idCol-1])===String(id)) {
      sheet.getRange(r+1,statusCol).setValue(status);
      return json_({ok:true,id:id,status:status});
    }
  }
  return json_({ok:false,error:'Order not found'});
}
