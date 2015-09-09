package Scot::Collection::Event;
use lib '../../../lib';
use Moose 2;

extends 'Scot::Collection';

with    qw(
    Scot::Role::GetByAttr
    Scot::Role::GetTagged
);

=head1 Name

Scot::Collection::Event

=head1 Description

Custom collection operations for Events

=head1 Methods

=over 4

=item B<create_from_api($api_ref)>

Create an event and from a POST to the handler

=cut


sub create_from_api {
    my $self    = shift;
    my $api     = shift;
    my $env     = $self->env;
    my $log     = $env->log;
    my $env     = $env;

    $log->trace("Create Event from API");

    my $build_href  = $api->get_request_params->{params};
    
    my @tags;
    if ( defined ( $build_href->{tags} ) ) {
        push @tags, @{ $build_href->{tags} };
        delete $build_href->{tags};
    }

    my @sources;
    if ( defined ( $build_href->{sources} ) ) { 
        push @sources, @{ $build_href->{sources} };
        delete $build_href->{sources};
    }

    if ( defined $build_href->{from_alerts} ) {
        $self->process_alerts($build_href);
    }

    my $entry_body = $build_href->{entry};
    delete $build_href->{entry};

    my $event   = $self->create($build_href);

    unless ($event) {
        $log->error("ERROR creating Event from ",
            { filter => \&Dumper, value => $build_href});
        return undef;
    }

    if ($entry_body) {
        $self->create_alert_entry($event, $entry_body);
    }

    my $id      = $event->id;
    if ( scalar(@sources) > 0 ) {
        $self->upsert_targetables("Source", "event", $id, @sources);
    }
    if ( scalar(@tags) > 0 ) {
        $self->upsert_targetables("Tag", "event", $id, @tags);
    }

    return $event;
}

sub process_alerts {
    my $self    = shift;
    my $bhref   = shift;
    my $env     = $self->env;
    my $mongo   = $self->meerkat;

    my $alerts_aref = $bhref->{from_alerts};
    delete $bhref->{from_alerts};
    my $cursor      = $mongo->collection("Alert")->find({
        id  => { '$in'  => $alerts_aref }
    });

    my @alertids    = ();
    my $body        = "";

    while ( my $alert   = $cursor->next ) {
        my $id  = $alert->id;
        my $ag  = $alert->alertgroup;
        push @alertids, $id;
        $body = $self->add_to_body($body, $alert);
    }

    $bhref->{entry}    = $body;
    $bhref->{alerts}   = \@alertids;
}

sub create_alert_entry {
    my $self    = shift;
    my $event   = shift;
    my $body    = shift;
    my $env     = $self->env;
    my $mongo   = $self->meerkat;
    my $entry_href = {
        target_type => "event",
        target_id   => $event->id,
        readgroups  => $event->readgroups,
        modifygroups=> $event->modifygroups,
        summary     => 0,
        body        => $body,
    };
    my $entry   = $entrycol->create_via_alert_promotion($entry_href);

}

sub add_to_body {
    my $self    = shift;
    my $body    = shift;
    my $alert   = shift;
    $body .= "<h4>Alert $id</h4>" . 
                "<table class=\"alert_in_entry\"><tr>".
                "  <th>ID</th>";

    foreach my $column (@{$alert->columns}) {
        $body .= "<th>" . $column . "</th>";
    }
    $body .= "</tr><tr>";

    $body .= "<th>".$id."</th>";
    foreach my $column (@{$alert->columns}) {
        $body .= "<th>". $alert->data_with_flair->{$column} . "</th>";
    }
    $body .= "</tr><table>";
    return $body;
}


=item B<build_from_alerts>

given a set of alert_id's build an event

1. get alerts cursor
2. foreach
    a. get columns and flair data
    b. add to proto entry body
    c. set alert status to promoted
    d. update alertgroup status
    e. create entry 

=cut

sub build_from_alerts {
    my $self        = shift;
    my $handler     = shift;
    my $build_href  = shift;
    my $env         = $handler->env;
    my $mongo       = $env->mongo;
    my $alerts_aref = $build_href->{from_alerts};

    my $alert_col   = $mongo->collection("Alert");
    my $agcol       = $mongo->collection("Alertgroup");
    my $entrycol    = $mongo->collection("Entry");
    my $cursor      = $alert_col->find({id => {'$in' => $alerts_aref} });

    my $subject     = '';
    my $body        = "<h3>Original Alerts</h3>";
    my @alertgroups = ();
    my @alert_ids   = ();

    while (my $alert = $cursor->next ) {
        my $id  = $alert->id;
        my $ag  = $alert->alertgroup;
        push @alert_ids, $id;

        $body .= "<h4>Alert $id</h4>" . 
                   "<table class=\"alert_in_entry\"><tr>".
                   "  <th>ID</th>";

        foreach my $column (@{$alert->columns}) {
            $body .= "<th>" . $column . "</th>";
        }
        $body .= "</tr><tr>";

        $body .= "<th>".$id."</th>";
        foreach my $column (@{$alert->columns}) {
            $body .= "<th>". $alert->data_with_flair->{$column} . "</th>";
        }
        $body .= "</tr><table>";
        my $agobj   = $agcol->find_iid($ag);
        $agobj->update_set(status=>"promoted");
        $agobj->update_inc(promoted_count => 1);
        $agobj->update_inc($alert->status."_count" => -1);
        $subject = $agobj->subject;
        $alert->update_set( status => "promoted");
    }
    
    $build_href->{subject}  = $subject unless $build_href->{subject};
    $build_href->{status}   = "open" unless $build_href->{status};
    $build_href->{owner}    = $handler->session('user') 
        unless $build_href->{owner};
    $build_href->{readgroups} = $env->default_groups->{readgroups}
        unless $build_href->{readgroups};
    $build_href->{modifygroups} = $env->default_groups->{modifygroups}
        unless $build_href->{modifygroups};
    $build_href->{alerts} = \@alert_ids;
    delete $build_href->{from_alerts};

    my $event = $self->create($build_href);
    
    my $entry_href = {
        target_type => "event",
        target_id   => $event->id,
        readgroups  => $build_href->{readgroups},
        modifygroups=> $build_href->{modifygroups},
        summary     => 0,
        body        => $body,
    };
    my $entry   = $entrycol->create_via_alert_promotion($handler,$entry_href);

    return $event;
}

1;
