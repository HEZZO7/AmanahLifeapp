// psql submits one statement at a time. Sending a whole fixture as one query
// changes implicit transaction boundaries and may roll back its initial DDL.
export function statements(sql) {
  const result=[];let start=0,quote=null,dollar=null,line=false,block=0;
  for(let i=0;i<sql.length;i++) {
    const a=sql[i],b=sql[i+1];
    if(line){if(a==='\n')line=false;continue;}
    if(block){if(a==='/'&&b==='*'){block++;i++;}else if(a==='*'&&b==='/'){block--;i++;}continue;}
    if(dollar){if(sql.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;}continue;}
    if(quote){if(a===quote){if(b===quote)i++;else quote=null;}continue;}
    if(a==='-'&&b==='-'){line=true;i++;continue;}
    if(a==='/'&&b==='*'){block=1;i++;continue;}
    if(a==="'"||a==='"'){quote=a;continue;}
    if(a==='$'){const tag=/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(sql.slice(i));if(tag){dollar=tag[0];i+=dollar.length-1;continue;}}
    if(a===';'){result.push(sql.slice(start,i+1));start=i+1;}
  }
  if(quote||dollar||block)throw Error('Unterminated SQL fixture');
  if(sql.slice(start).trim())result.push(sql.slice(start));
  return result;
}
