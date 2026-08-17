import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PreferencesService } from '../services/preferences.service';

@Component({
  selector: 'app-default-redirect',
  standalone: true,
  template: '',
})
export class DefaultRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly preferences = inject(PreferencesService);

  ngOnInit(): void {
    void this.router.navigateByUrl(this.preferences.defaultLandingPath, { replaceUrl: true });
  }
}
