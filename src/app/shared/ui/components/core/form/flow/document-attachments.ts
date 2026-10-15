import { signal } from '@angular/core';
import type { MediaService } from '../../../../../core/base/services/media/media.service';
import type { DocumentAttachment } from '../../../../../core/contracts/media/document-attachment.interface';
import type { FormFlowStepModel, FormFlowActionEvent } from '@fssrepository/myscoutee-components';

/** Shared document block used by announcement and campaign editors. */
export class DocumentAttachments {
  readonly uploading = signal(false);
  readonly error = signal('');
  private generation = 0;
  constructor(private readonly media: MediaService, private readonly context: {
    files: () => DocumentAttachment[]; setFiles: (files: DocumentAttachment[]) => void;
    ownerId: () => string; entityId: () => string; readOnly: () => boolean; busy: () => boolean;
  }) {}
  reset(): void { this.generation++; this.uploading.set(false); this.error.set(''); }
  steps(t: (key: string) => string): FormFlowStepModel[] {
    const files=this.context.files(), readOnly=this.context.readOnly(), busy=this.uploading()||this.context.busy();
    return [{id:'attachments',title:t('announcement.attachments'),icon:'attach_file',
      headerControl:readOnly?null:{id:'attach',kind:'menu',config:{kind:'inline',items:[
        {id:'attach',icon:'add',ariaLabel:'announcement.attach',palette:'green',disabled:busy||files.length>=10}]}},
      controls:readOnly&&!files.length
        ? [{id:'attachment-empty',kind:'static',layout:'wide',summary:{value:()=>t('announcement.attachments.empty')}}]
        : [{id:'attachment-files',guideFieldId:'attachments',kind:'table',layout:'wide',
        config:{rows:files.map((file,index)=>({id:`attachment-${index}`,label:file.name,value:'',actions:[
          readOnly
            ? {id:'download',icon:'download',ariaLabel:'download',palette:'blue' as const,context:index}
            : {id:'remove',icon:'delete',ariaLabel:'remove',palette:'red' as const,context:index,disabled:busy}
        ]}))}}]}];
  }
  action(event:FormFlowActionEvent,input:HTMLInputElement):void {
    const action=event.sourceEvent.id, blocked=this.context.readOnly()||this.uploading()||this.context.busy();
    if(action==='attach'){if(!blocked)input.click();return;}
    const index=Number(event.context),files=this.context.files(),file=files[index];
    if(!Number.isInteger(index)||!file)return;
    if(action==='remove'){if(!blocked)this.context.setFiles(files.filter((_,i)=>i!==index));}
    else if(action==='download')void this.download(file);
  }
  async upload(event:Event):Promise<void> {
    const input=event.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';
    if(this.uploading()||this.context.readOnly()||this.context.busy())return;
    const generation=this.generation;this.uploading.set(true);this.error.set('');
    try {
      if(files.length+this.context.files().length>10)throw new Error();
      for(const file of files){
        const result=await this.media.uploadDocument(this.context.ownerId(),this.context.entityId(),file);
        if(generation!==this.generation)return;
        if(!result.uploaded||!result.url)throw new Error();
        this.context.setFiles([...this.context.files(),{name:file.name,url:result.url,mimeType:file.type,sizeBytes:file.size}]);
      }
    }catch{if(generation===this.generation)this.error.set('announcement.attachment.failed');}
    finally{if(generation===this.generation)this.uploading.set(false);}
  }
  private async download(file:DocumentAttachment):Promise<void>{
    const generation=this.generation;this.error.set('');
    try{await this.media.downloadDocument(file.url,file.name);}catch{if(generation===this.generation)this.error.set('announcement.attachment.open.failed');}
  }
}
