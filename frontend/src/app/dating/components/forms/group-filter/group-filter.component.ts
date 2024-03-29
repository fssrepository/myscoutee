import { HttpParams } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { NavigationService } from 'src/app/navigation.service';
import { DataService } from 'src/app/services/data.service';
import { HttpService } from 'src/app/services/http.service';

interface Option {
  value: string;
  viewValue: string;
}

// distance bar also, not just calendar bar

@Component({
  selector: 'app-group-filter',
  templateUrl: './group-filter.component.html',
})
export class GroupFilterComponent implements OnInit {
  formGroup: UntypedFormGroup;

  progress: any = { mode: 'determine', value: 0, color: 'primary' };

  url: any;

  key: any;

  setting: any;

  constructor(
    private fb: UntypedFormBuilder,
    public dialogRef: MatDialogRef<GroupFilterComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dataService: DataService,
    private activatedRoute: ActivatedRoute,
    private httpService: HttpService,
    private navService: NavigationService
  ) {
    this.url = '/user/settings';

    let actionUrl = this.activatedRoute['_routerState'].snapshot.url.replace(
      '/base',
      ''
    );

    actionUrl = actionUrl.substring(1);
    this.key = actionUrl.substring(actionUrl.indexOf('/'));
  }

  isNumber(str) {
    return !isNaN(parseInt(str)) && isFinite(str);
  }

  onData(key, evt, idx?): void {
    var value = this.isNumber(evt.target.value) ? parseInt(evt.target.value) : evt.target.value;
    if (idx != undefined) {
      var valueArray = this.formGroup.controls[key].getRawValue();
      valueArray[idx] = value;
      this.formGroup.controls[key].setValue(valueArray);
    } else {
      this.formGroup.controls[key].setValue(value);
    }
  }

  ngOnInit(): void {
    let params = new HttpParams();
    params = params.set('key', this.key);

    this.httpService.get(this.url, params).subscribe({
      next: (result) => {
        let formGroup = new UntypedFormGroup({});

        this.setting = result["setting"];
        this.setting.items.map((item) => {
          switch (item.type) {
            case 'os':
              formGroup.addControl(item.name, new UntypedFormControl([...item.data]));
              break;
            case 'ms':
              formGroup.addControl(item.name, new UntypedFormArray([new UntypedFormControl(item.data[0]), new UntypedFormControl(item.data[1])]));
              break;
            default:
          }
        });

        this.formGroup = formGroup;
      },
      error: (error) => {
        this.progress.mode = 'determine';
        this.progress.color = 'warn';
      },
      complete: () => {
        console.log('complete');
      },
    });
  }

  onClick(): void {
    if (this.formGroup.valid) {
      let raw = this.formGroup.getRawValue();

      let items = this.setting.items.map((item) => {
        if (raw[item.name] instanceof Array) {
          item.data = [...raw[item.name]];
        } else {
          item.data = [raw[item.name]];
        }
        return item;
      });

      this.setting.items = items;

      let params = new HttpParams();
      params = params.set('key', this.key);

      this.httpService.save(this.url, this.setting, params).subscribe({
        next: (result) => {
          this.dialogRef.close(result['setting']['items']);
        },
        error: (error) => {
          this.progress.mode = 'determine';
          this.progress.color = 'warn';
        },
        complete: () => {
          this.progress.mode = 'determine';
        },
      });
    }
  }

  back(): void {
    this.dialogRef.close();
  }
}
